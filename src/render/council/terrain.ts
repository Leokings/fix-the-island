import * as THREE from 'three';

/** Small deterministic value noise so the diorama looks the same every load. */
function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x: number, z: number) => noise(x, z) * 0.6 + noise(x * 2.1, z * 2.1) * 0.3 + noise(x * 4.3, z * 4.3) * 0.1;

/** The creek winds across the north of the clearing. */
export const creekZ = (x: number) => -6.2 + Math.sin(x * 0.23 + 0.6) * 1.4;
export const CREEK_HALF_WIDTH = 1.5;
export const ISLAND_RADIUS = 16;

const smooth = (a: number, b: number, t: number) => {
  const k = THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};

export function groundHeight(x: number, z: number): number {
  const r = Math.hypot(x * 0.92, z * 1.08) + (fbm(x * 0.18, z * 0.18) - 0.5) * 3.2;
  let h = 0.62 * (1 - smooth(ISLAND_RADIUS - 5, ISLAND_RADIUS + 0.5, r)) - 0.55 * smooth(ISLAND_RADIUS - 1, ISLAND_RADIUS + 3, r);
  h += (fbm(x * 0.35 + 9, z * 0.35) - 0.5) * 0.28 * (1 - smooth(10, 15, r));
  // A gentle rise to the south-east gives the clearing a backdrop.
  h += 1.6 * smooth(9, 3, Math.hypot(x + 7.5, z - 6.5)) * (0.7 + fbm(x * 0.6, z * 0.6) * 0.6);
  const d = Math.abs(z - creekZ(x));
  if (d < CREEK_HALF_WIDTH + 0.9) h -= 0.6 * smooth(CREEK_HALF_WIDTH + 0.9, 0.2, d);
  // Flatten the council circle.
  const c = Math.hypot(x, z);
  if (c < 4.5) h = THREE.MathUtils.lerp(0.5, h, smooth(2.8, 4.5, c));
  return h;
}

export interface Palette { grass: THREE.Color; grassDry: THREE.Color; sand: THREE.Color; mud: THREE.Color; rock: THREE.Color }

/** Flat-shaded terrain whose vertex colours can be blended from storm-dry to lush. */
export class IslandGround {
  readonly mesh: THREE.Mesh;
  private readonly lush: Float32Array;
  private readonly dry: Float32Array;
  private readonly colors: THREE.BufferAttribute;

  constructor(palette: Palette) {
    const size = 44, seg = 120;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2).toNonIndexed();
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)));
    const n = pos.count;
    this.lush = new Float32Array(n * 3);
    this.dry = new Float32Array(n * 3);
    const tmp = new THREE.Color(), tmpDry = new THREE.Color();
    // Colour per face so flat shading reads as crisp facets.
    for (let f = 0; f < n; f += 3) {
      let cx = 0, cy = 0, cz = 0;
      for (let k = 0; k < 3; k++) { cx += pos.getX(f + k) / 3; cy += pos.getY(f + k) / 3; cz += pos.getZ(f + k) / 3; }
      const jitter = (hash(cx * 3.1, cz * 2.7) - 0.5) * 0.025;
      const creek = Math.abs(cz - creekZ(cx));
      if (cy < 0.08) { tmp.copy(palette.sand).offsetHSL(0, 0, jitter - 0.04); tmpDry.copy(tmp); }
      else if (cy < 0.22 && creek > CREEK_HALF_WIDTH + 1) { tmp.copy(palette.sand).offsetHSL(0, 0, jitter); tmpDry.copy(tmp); }
      else if (creek < CREEK_HALF_WIDTH + 0.4) { tmp.copy(palette.mud).offsetHSL(0, 0, jitter); tmpDry.copy(palette.mud).offsetHSL(0.01, -0.1, jitter + 0.05); }
      else if (cy > 1.1 && hash(cx, cz) > 0.55) { tmp.copy(palette.rock).offsetHSL(0, 0, jitter); tmpDry.copy(tmp); }
      else {
        const m = fbm(cx * 0.5, cz * 0.5);
        tmp.copy(palette.grass).offsetHSL((m - 0.5) * 0.04, 0, jitter + (m - 0.5) * 0.08);
        tmpDry.copy(palette.grassDry).offsetHSL((m - 0.5) * 0.03, 0, jitter + (m - 0.5) * 0.06);
      }
      for (let k = 0; k < 3; k++) { tmp.toArray(this.lush, (f + k) * 3); tmpDry.toArray(this.dry, (f + k) * 3); }
    }
    this.colors = new THREE.BufferAttribute(new Float32Array(this.dry), 3);
    geo.setAttribute('color', this.colors);
    geo.computeVertexNormals();
    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
    this.mesh.receiveShadow = true;
    this.mesh.name = 'council-ground';
  }

  /** 0 = storm-dry, 1 = lush. Habitat recovery drives this, never a timer. */
  setLushness(t: number): void {
    const out = this.colors.array as Float32Array;
    for (let i = 0; i < out.length; i++) out[i] = this.dry[i]! + (this.lush[i]! - this.dry[i]!) * t;
    this.colors.needsUpdate = true;
  }
}

/** Low-poly animated sea with a foam ring at the shoreline. */
export class Sea {
  readonly group = new THREE.Group();
  private readonly geo: THREE.BufferGeometry;
  private readonly base: Float32Array;
  private readonly foam: THREE.Mesh;

  constructor(color: THREE.Color) {
    this.geo = new THREE.PlaneGeometry(160, 160, 70, 70).rotateX(-Math.PI / 2).toNonIndexed();
    this.base = new Float32Array((this.geo.attributes.position as THREE.BufferAttribute).array);
    const mat = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.92 });
    const sea = new THREE.Mesh(this.geo, mat);
    sea.receiveShadow = true;
    this.group.add(sea);
    const foamGeo = new THREE.RingGeometry(ISLAND_RADIUS - 0.4, ISLAND_RADIUS + 1.6, 96, 1).rotateX(-Math.PI / 2);
    const fp = foamGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < fp.count; i++) {
      const x = fp.getX(i), z = fp.getZ(i), a = Math.atan2(z, x);
      // Push the ring onto the actual shoreline by marching outward until the ground drops below sea level.
      let r = 6;
      while (r < 26 && groundHeight(Math.cos(a) * r, Math.sin(a) * r) > 0.02) r += 0.1;
      const inner = Math.hypot(x, z) < ISLAND_RADIUS + 0.5;
      const rr = inner ? r - 0.5 : r + 0.9;
      fp.setXYZ(i, Math.cos(a) * rr, 0.05, Math.sin(a) * rr);
    }
    this.foam = new THREE.Mesh(foamGeo, new THREE.MeshBasicMaterial({ color: 0xf4fbf6, transparent: true, opacity: 0.55, depthWrite: false }));
    this.group.add(this.foam);
  }

  update(t: number): void {
    const p = this.geo.attributes.position as THREE.BufferAttribute;
    const a = p.array as Float32Array;
    for (let i = 0; i < p.count; i++) {
      const x = this.base[i * 3]!, z = this.base[i * 3 + 2]!;
      a[i * 3 + 1] = Math.sin(x * 0.35 + t * 0.9) * 0.08 + Math.cos(z * 0.3 + t * 0.7) * 0.08 + Math.sin((x + z) * 0.8 + t * 1.6) * 0.03;
    }
    p.needsUpdate = true;
    this.geo.computeVertexNormals();
    (this.foam.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(t * 1.3) * 0.15;
    this.foam.scale.setScalar(1 + Math.sin(t * 1.3) * 0.006);
  }
}

/** Water inside the creek bed; its level shows the water consequence. */
export class Creek {
  readonly mesh: THREE.Mesh;
  private level = 0.02;
  private target = 0.02;
  constructor(color: THREE.Color) {
    const geo = new THREE.PlaneGeometry(40, CREEK_HALF_WIDTH * 2 + 1.2, 80, 4).rotateX(-Math.PI / 2);
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + creekZ(p.getX(i)));
    geo.computeVertexNormals();
    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 }));
    this.mesh.receiveShadow = true;
    this.mesh.position.y = this.level;
  }
  setLevel(level: number): void { this.target = level; }
  snap(level: number): void { this.level = this.target = level; this.mesh.position.y = level; }
  update(dt: number, t: number): void {
    this.level += (this.target - this.level) * Math.min(1, dt * 1.2);
    this.mesh.position.y = this.level + Math.sin(t * 2) * 0.01;
  }
}
