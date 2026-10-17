import * as THREE from 'three';
import { SITE_PLAN } from '../../content/site-plan';
import type { RepairDressing } from '../../content/repair-dressing';
import { sampleGround, type LevelData, type Obstacle, type Vec3, type WalkTriangle } from '../../domain/terrain';
import {
  BRIDGE_DECK, COMMONS, COUNCIL_SEATS, TROUGH, CREEK, HOUSES, creekProfile, CREEK_WATER_DROP, FORD, FORD_RADIUS, ISLAND_CENTRE, ISLAND_LEVEL_ID, PAD_RADIUS, PIER, SITE_ANCHORS, SPAWN,
  biomeAt, coastDistance, creekInfo, fbm, groundHeight, isWet, landHeight, overlayAt, pathDistance, rand, smoothstep, type Biome, type Point, GULL_LEDGE, WINDMILL_PADS } from '../../content/stylized-island';
import { VillageLife, type VillageDesign } from './village-life';
import { Kit } from './pump-machinery';
import { PALETTE, bake, bush, concat, debris, fern, firePit, flowers, grassTuft, house, palm, pier, pine, reeds, rock, roundTree, type Piece } from './props';

export interface StylizedWorld {
  readonly group: THREE.Group;
  readonly level: LevelData;
  readonly dressing: readonly RepairDressing[];
  readonly stats: Readonly<Record<string, unknown>>;
}
/** Update hook the renderer calls each frame with display state only. */
export type EnvironmentUpdate = (seconds: number, restored: ReadonlySet<string>, dt: number) => void;

const GRID = 0.6;
const BOUNDS = { minX: -40, maxX: 38, minZ: -38, maxZ: 34 };
const SITE_IDS = Object.keys(SITE_ANCHORS);
const RECOVERY_RADIUS: [number, number] = [9, 17];

const TERRAIN: Record<Biome, { dry: THREE.Color; lush: THREE.Color }> = {
  // Storm state is moody autumn (GAME-DESIGN §12); restored state is fresh green.
  beach: { dry: new THREE.Color(0xe3c48e), lush: new THREE.Color(0xecd29c) },
  grass: { dry: new THREE.Color(0x7f8a40), lush: new THREE.Color(0x6eae48) },
  woodland: { dry: new THREE.Color(0x6c7a3a), lush: new THREE.Color(0x4f9443) },
  upland: { dry: new THREE.Color(0x7d8664), lush: new THREE.Color(0x7aa65a) },
  rock: { dry: new THREE.Color(0xa38d70), lush: new THREE.Color(0xa38d70) },
  path: { dry: new THREE.Color(0xcf883c), lush: new THREE.Color(0xd59244) },
  mud: { dry: new THREE.Color(0x76624a), lush: new THREE.Color(0x66563f) },
};
const SEABED = new THREE.Color(0xcdb98a);
const PATCH = { ochre: new THREE.Color(0xb08a3e), rust: new THREE.Color(0x9a5a32), spring: new THREE.Color(0x9cc45a) };

/** Per-vertex recovery: dry and lush colours plus each site's influence. */
class Recovery {
  private readonly dry: Float32Array;
  private readonly lush: Float32Array;
  private readonly influence: Float32Array[];
  constructor(private readonly attr: THREE.BufferAttribute, lushAttr: THREE.BufferAttribute, positions: THREE.BufferAttribute, private readonly globalShare = 0.18) {
    this.dry = new Float32Array(attr.array as Float32Array);
    this.lush = new Float32Array(lushAttr.array as Float32Array);
    this.influence = SITE_IDS.map(id => {
      const p = SITE_ANCHORS[id]!, out = new Float32Array(positions.count);
      for (let i = 0; i < positions.count; i++) out[i] = 1 - smoothstep(RECOVERY_RADIUS[0], RECOVERY_RADIUS[1], Math.hypot(positions.getX(i) - p.x, positions.getZ(i) - p.z));
      return out;
    });
  }
  apply(levels: readonly number[], calm: number): void {
    const out = this.attr.array as Float32Array, n = this.influence[0]!.length;
    for (let i = 0; i < n; i++) {
      let w = calm * this.globalShare;
      for (let s = 0; s < levels.length; s++) { const v = levels[s]! * this.influence[s]![i]!; if (v > w) w = v; }
      for (let k = 0; k < 3; k++) { const j = i * 3 + k; out[j] = this.dry[j]! + (this.lush[j]! - this.dry[j]!) * w; }
    }
    this.attr.needsUpdate = true;
  }
}

/** Painted ground grain: soft dabs and little three-stroke tufts, multiplied over the vertex colours. */
function grainTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const size = 256, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 1400; i++) {
    const x = rand(i, 1.1) * size, y = rand(i, 2.3) * size, r = 2 + rand(i, 3.7) * 7, v = 214 + Math.floor(rand(i, 5.9) * 41);
    g.fillStyle = `rgba(${v},${v},${v},0.55)`; g.beginPath(); g.ellipse(x, y, r * 1.5, r, rand(i, 7.1) * 3, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = 'rgba(150,150,150,0.55)'; g.lineWidth = 1.4;
  for (let i = 0; i < 260; i++) {
    const x = rand(i, 8.8) * size, y = rand(i, 9.9) * size;
    g.beginPath(); for (const dx of [-2.5, 0, 2.5]) { g.moveTo(x + dx, y); g.lineTo(x + dx * 1.6, y - 5 - Math.abs(dx)); } g.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}

/** Shoreline radius from the island centre at an angle: first point outward where the ground meets the sea. Tabulated once. */
let shoreTable: Float32Array | null = null;
const SHORE_STEPS = 720;
function shoreRadius(a: number): number {
  if (!shoreTable) {
    shoreTable = new Float32Array(SHORE_STEPS + 1);
    const dry = (ang: number, r: number) => groundHeight(ISLAND_CENTRE.x + Math.cos(ang) * r, ISLAND_CENTRE.z + Math.sin(ang) * r) > 0.02;
    for (let k = 0; k <= SHORE_STEPS; k++) {
      const ang = -Math.PI + k / SHORE_STEPS * Math.PI * 2;
      // Coarse 1 m march, then refine the last metre at the original 0.12 m step.
      let r = 8; while (r < 45 && dry(ang, r)) r += 1;
      let f = Math.max(8, r - 1); while (f < r && f < 45 && dry(ang, f)) f += 0.12;
      shoreTable[k] = Math.min(f, 45);
    }
  }
  const u = ((a + Math.PI) / (Math.PI * 2) % 1 + 1) % 1 * SHORE_STEPS, k = Math.floor(u), t = u - k;
  return shoreTable[k]! + (shoreTable[k + 1]! - shoreTable[k]!) * t;
}

function terrainMesh(): { mesh: THREE.Mesh; walk: WalkTriangle[]; recovery: Recovery } {
  const cols = Math.round((BOUNDS.maxX - BOUNDS.minX) / GRID), rows = Math.round((BOUNDS.maxZ - BOUNDS.minZ) / GRID);
  const heights = new Float32Array((cols + 1) * (rows + 1));
  const at = (i: number, j: number) => heights[j * (cols + 1) + i]!;
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) heights[j * (cols + 1) + i] = groundHeight(BOUNDS.minX + i * GRID, BOUNDS.minZ + j * GRID);
  const pos: number[] = [], uv: number[] = [], dry: number[] = [], lush: number[] = [], walk: WalkTriangle[] = [];
  const v = (i: number, j: number): Vec3 => ({ x: BOUNDS.minX + i * GRID, y: at(i, j), z: BOUNDS.minZ + j * GRID });
  // Vertex colours blend biomes softly (paths, creek bed); a small per-face jitter keeps the facets.
  const vertexColor = new Map<string, { d: THREE.Color; l: THREE.Color }>();
  const colourAt = (p: Vec3) => {
    const key = `${p.x},${p.z}`, hit = vertexColor.get(key);
    if (hit) return hit;
    // Slope from the neighbouring grid heights (rescaled to the 1 m baseline the biome thresholds use).
    const i = Math.round((p.x - BOUNDS.minX) / GRID), j = Math.round((p.z - BOUNDS.minZ) / GRID), ih = (a: number, b: number) => at(Math.max(0, Math.min(cols, a)), Math.max(0, Math.min(rows, b)));
    const slope = Math.hypot(ih(i + 1, j) - ih(i - 1, j), ih(i, j + 1) - ih(i, j - 1)) / (2 * GRID);
    let base = p.y < -0.15 ? { dry: SEABED, lush: SEABED } : TERRAIN[biomeAt(p.x, p.z, p.y, slope)];
    const o = overlayAt(p.x, p.z), shade = (fbm(p.x * 0.35, p.z * 0.35) - 0.5) * 0.07;
    // Broad ground patches (ochre and rust in the storm, yellow-green when restored) and stratified ledges.
    const patch = smoothstep(0.5, 0.66, fbm(p.x * 0.11 + 3, p.z * 0.11 - 7)), rust = smoothstep(0.56, 0.7, fbm(p.x * 0.14 - 9, p.z * 0.14 + 2));
    // Stratified cliff faces: alternating pale and shadowed bands by height.
    const ledge = base === TERRAIN.rock ? (Math.sin(p.y * 4.2 + fbm(p.x * 0.3, p.z * 0.3) * 2) > 0 ? 0.1 : -0.08) : 0;
    base = { dry: base.dry.clone().lerp(PATCH.ochre, patch * 0.6).lerp(PATCH.rust, rust * 0.45).offsetHSL(0, 0, ledge), lush: base.lush.clone().lerp(PATCH.spring, patch * 0.6).offsetHSL(0, 0, ledge) };
    const d = base.dry.clone().lerp(TERRAIN.path.dry, o.path * 0.85).lerp(TERRAIN.mud.dry, o.mud).offsetHSL(0, 0, shade);
    const l = base.lush.clone().lerp(TERRAIN.path.lush, o.path * 0.85).lerp(TERRAIN.mud.lush, o.mud).offsetHSL(0, 0, shade);
    const out = { d, l }; vertexColor.set(key, out); return out;
  };
  const wetVertex = new Map<string, boolean>();
  const wetAt = (p: Vec3) => { const key = `${p.x},${p.z}`; let w = wetVertex.get(key); if (w === undefined) { w = isWet(p.x, p.z, p.y); wetVertex.set(key, w); } return w; };
  const tri = (a: Vec3, b: Vec3, c: Vec3) => {
    const cx = (a.x + b.x + c.x) / 3, cz = (a.z + b.z + c.z) / 3, cy = (a.y + b.y + c.y) / 3;
    const n = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z).cross(new THREE.Vector3(c.x - a.x, c.y - a.y, c.z - a.z)).normalize();
    const slope = Math.sqrt(Math.max(0, 1 - n.y * n.y)) / Math.max(0.05, Math.abs(n.y));
    const biome = cy < -0.15 ? null : overlayAt(cx, cz).path > 0.6 ? 'path' : biomeAt(cx, cz, cy, slope);
    const j = (rand(cx * 3.1, cz * 2.7) - 0.5) * 0.03;
    for (const p of [a, b, c]) {
      const { d, l } = colourAt(p);
      pos.push(p.x, p.y, p.z); uv.push(p.x * 0.21, p.z * 0.21);
      dry.push(d.r * (1 + j), d.g * (1 + j), d.b * (1 + j)); lush.push(l.r * (1 + j), l.g * (1 + j), l.b * (1 + j));
    }
    if (biome && ![a, b, c].some(wetAt) && n.y > 0)
      walk.push({ id: `isle:${walk.length}`, a, b, c, biome });
  };
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = v(i, j), b = v(i + 1, j), c = v(i, j + 1), d = v(i + 1, j + 1);
    // Alternate the diagonal for a less regular faceting. Winding keeps normals up.
    if ((i + j) % 2) { tri(a, c, b); tri(b, c, d); } else { tri(a, c, d); tri(a, d, b); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const colorAttr = new THREE.Float32BufferAttribute(dry, 3), lushAttr = new THREE.Float32BufferAttribute(lush, 3);
  geo.setAttribute('color', colorAttr);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, map: grainTexture() }));
  mesh.name = 'island-terrain'; mesh.receiveShadow = true; mesh.userData.category = 'ground';
  return { mesh, walk, recovery: new Recovery(colorAttr, lushAttr, geo.getAttribute('position') as THREE.BufferAttribute) };
}

// ——— Water ———
/** Waves run on the GPU so the sea can be finely faceted for a real shallow-to-deep gradient. */
function waveMaterial(params: THREE.MeshStandardMaterialParameters, time: { value: number }, amp = 1): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial(params);
  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = time;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvec4 wp = modelMatrix * vec4(transformed, 1.0);\n' +
      'transformed.y += (sin(wp.x * 0.32 + uTime * 0.8) * 0.07 + cos(wp.z * 0.27 + uTime * 0.6) * 0.07 + sin((wp.x + wp.z) * 0.7 + uTime * 1.5) * 0.025) * ' + amp.toFixed(2) + ';');
  };
  material.customProgramCacheKey = () => 'island-waves-' + amp;
  return material;
}

class Sea {
  readonly group = new THREE.Group();
  private readonly time = { value: 0 };
  private readonly foam: THREE.Mesh;
  private readonly band: THREE.Mesh;
  private readonly ripples: THREE.Mesh;
  constructor() {
    const size = 200, seg = 150;
    // Smooth per-vertex colour: a bright turquoise rim over sand, then a saturated deep-blue body.
    const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
    geo.translate(ISLAND_CENTRE.x, -0.02, ISLAND_CENTRE.z);
    const p = geo.getAttribute('position'), colors = new Float32Array(p.count * 3);
    const rim = new THREE.Color(0x58cbc2), shallow = new THREE.Color(0x249fbf), mid = new THREE.Color(0x2482b2), deep = new THREE.Color(0x1d4f8e), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), d = coastDistance(x, z);
      // Weights rise toward the shore: deep offshore, mid blue, shallow turquoise, bright rim at the sand.
      c.copy(deep).lerp(mid, smoothstep(-11, -4.5, d)).lerp(shallow, smoothstep(-3.4, -1.3, d)).lerp(rim, smoothstep(-0.9, 0.3, d));
      c.offsetHSL(0, 0, (fbm(x * 0.12, z * 0.12) - 0.5) * 0.06);
      c.toArray(colors, i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const sea = new THREE.Mesh(geo, waveMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, envMapIntensity: 0.2 }, this.time));
    sea.name = 'island-sea'; sea.receiveShadow = true; sea.userData.category = 'water'; sea.renderOrder = 1;
    this.group.add(sea);
    const shore = shoreRadius;
    const ringAt = (inner: number, outer: number, wobble: number) => {
      const ring = new THREE.RingGeometry(1, 2, 220, 1).rotateX(-Math.PI / 2), rp = ring.getAttribute('position');
      for (let i = 0; i < rp.count; i++) {
        const a = Math.atan2(rp.getZ(i), rp.getX(i)), out = Math.hypot(rp.getX(i), rp.getZ(i)) > 1.5, r = shore(a) + Math.sin(a * 23) * wobble;
        rp.setXYZ(i, ISLAND_CENTRE.x + Math.cos(a) * (r + (out ? outer : inner)), 0.16, ISLAND_CENTRE.z + Math.sin(a) * (r + (out ? outer : inner)));
      }
      return ring;
    };
    this.foam = new THREE.Mesh(ringAt(-0.35, 1.1, 0.15), new THREE.MeshBasicMaterial({ color: 0xf6fbf6, transparent: true, opacity: 0.55, depthWrite: false }));
    this.band = new THREE.Mesh(ringAt(2.4, 2.75, 0.5), new THREE.MeshBasicMaterial({ color: 0xe8f7f2, transparent: true, opacity: 0.35, depthWrite: false }));
    // Dashed contour ripples that follow the shoreline at three offsets.
    const strokes: number[] = [];
    for (const [k, off] of [[0, 3.4], [1, 5.6], [2, 8.6]] as const) {
      let prev: [number, number] | null = null;
      for (let a = -Math.PI; a < Math.PI; a += 0.008) {
        const on = Math.sin(a * (34 - k * 6) + k * 2.1) + (fbm(a * 3 + k, k) - 0.5) * 1.6 > 0.35;
        const r = shore(a) + off + Math.sin(a * 9 + k) * 0.5, here: [number, number] = [ISLAND_CENTRE.x + Math.cos(a) * r, ISLAND_CENTRE.z + Math.sin(a) * r];
        if (on && prev && Math.hypot(here[0] - prev[0], here[1] - prev[1]) < 0.9 && groundHeight(here[0], here[1]) < -0.15 && groundHeight(prev[0], prev[1]) < -0.15) {
          const w = 0.09 - k * 0.02, nx = Math.cos(a) * w, nz = Math.sin(a) * w;
          strokes.push(prev[0] - nx, 0.17, prev[1] - nz, here[0] - nx, 0.17, here[1] - nz, prev[0] + nx, 0.17, prev[1] + nz,
            prev[0] + nx, 0.17, prev[1] + nz, here[0] - nx, 0.17, here[1] - nz, here[0] + nx, 0.17, here[1] + nz);
        }
        prev = here;
      }
    }
    // Sparse short strokes further out: the smaller wave scale.
    for (let i = 0; i < 220; i++) {
      const a = rand(i, 3.1) * Math.PI * 2, r = shore(a) + 10 + Math.pow(rand(i, 7.7), 1.4) * 28;
      const x = ISLAND_CENTRE.x + Math.cos(a) * r, z = ISLAND_CENTRE.z + Math.sin(a) * r, len = 0.5 + rand(i, 2.2) * 1.3, w = 0.07;
      const tx = -Math.sin(a), tz = Math.cos(a);
      const x0 = x - tx * len, z0 = z - tz * len, x1 = x + tx * len, z1 = z + tz * len;
      const v = (px: number, pz: number, side: number) => [px + Math.cos(a) * w * side, 0.17, pz + Math.sin(a) * w * side];
      const A = v(x0, z0, -1), B = v(x0, z0, 1), C = v(x1, z1, -1), D = v(x1, z1, 1);
      strokes.push(...A, ...C, ...B, ...B, ...C, ...D);
    }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(strokes, 3));
    this.ripples = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));
    for (const m of [this.foam, this.band, this.ripples]) { m.userData.category = 'water'; m.renderOrder = 2; this.group.add(m); }
    this.foam.name = 'island-foam';
  }
  /** Foam rings around posts and rocks standing in the water. */
  addPostFoam(points: readonly { x: number; z: number; r: number }[]): void {
    const pos: number[] = [];
    for (const p of points) {
      const g = new THREE.RingGeometry(p.r, p.r + 0.16, 10, 1).rotateX(-Math.PI / 2).toNonIndexed(), a = g.getAttribute('position');
      for (let i = 0; i < a.count; i++) pos.push(a.getX(i) + p.x, 0.16, a.getZ(i) + p.z);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xf6fbf6, transparent: true, opacity: 0.7, depthWrite: false }));
    m.renderOrder = 3; m.userData.category = 'water'; this.group.add(m);
  }
  update(t: number): void {
    this.time.value = t;
    (this.foam.material as THREE.MeshBasicMaterial).opacity = 0.42 + Math.sin(t * 1.2) * 0.14;
    (this.band.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.sin(t * 1.2 - 1.6) * 0.14;
    this.band.scale.setScalar(1 + Math.sin(t * 1.2 - 1.6) * 0.004);
    (this.ripples.material as THREE.MeshBasicMaterial).opacity = 0.22 + Math.sin(t * 0.9) * 0.08;
    this.ripples.position.set(Math.sin(t * 0.21) * 0.35, 0, Math.cos(t * 0.17) * 0.35);
  }
}

/** Creek water ribbon. Its height drop shows whether the supply has been restored. */
class Creek {
  readonly mesh: THREE.Mesh;
  private readonly land: Float32Array;
  private foamStart = 0;
  private dropScale = new Float32Array(0);
  private drop: number = CREEK_WATER_DROP.storm;
  constructor() {
    // The creek profile only runs downhill; water rides a fixed drop below its top (waterfalls where it steps).
    const centre = creekProfile().map(p => ({ x: p.x, z: p.z, w: p.w, top: p.top }));
    const pos: number[] = [], land: number[] = [];
    const edge = (i: number, side: number): [number, number, number] => {
      const p = centre[i]!, q = centre[Math.min(centre.length - 1, i + 1)]!, r = centre[Math.max(0, i - 1)]!;
      const dx = q.x - r.x, dz = q.z - r.z, l = Math.hypot(dx, dz) || 1;
      const w = p.w + 0.2;
      return [p.x - (dz / l) * w * side, p.top, p.z + (dx / l) * w * side];
    };
    for (let i = 0; i < centre.length - 1; i++) {
      const a = edge(i, -1), b = edge(i, 1), c = edge(i + 1, -1), d = edge(i + 1, 1);
      for (const v of [a, c, b, b, c, d]) { pos.push(v[0], 0, v[2]); land.push(v[1]); }
    }
    this.foamStart = pos.length / 3;
    const inset = (i: number, side: number, k: number): [number, number, number] => {
      const e = edge(i, side), p = centre[i]!; return [e[0] + (p.x - e[0]) * k, e[1], e[2] + (p.z - e[2]) * k];
    };
    for (let i = 0; i < centre.length - 1; i++) for (const side of [-1, 1]) {
      const wob = 0.12 + rand(i, side) * 0.1;
      const a = inset(i, side, 0.0), b = inset(i, side, wob), c = inset(i + 1, side, 0.0), d = inset(i + 1, side, wob);
      for (const v of [a, c, b, b, c, d]) { pos.push(v[0], 0.015, v[2]); land.push(v[1]); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.land = new Float32Array(land);
    const vp = geo.getAttribute('position');
    this.dropScale = new Float32Array(vp.count);
    this.dropScale.fill(1);
    geo.addGroup(0, this.foamStart, 0); geo.addGroup(this.foamStart, pos.length / 3 - this.foamStart, 1);
    this.mesh = new THREE.Mesh(geo, [new THREE.MeshStandardMaterial({ color: 0x4fb5c8, flatShading: true, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88, side: THREE.DoubleSide }), new THREE.MeshBasicMaterial({ color: 0xf2faf6, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide })]);
    this.mesh.name = 'island-creek'; this.mesh.userData.category = 'water'; this.mesh.receiveShadow = true;
    this.centre = centre;
    // Flow streaks: short white dashes carried downstream along the centre line.
    const streaks = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.55, 0.05).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }), 90);
    streaks.frustumCulled = false; streaks.userData.category = 'water'; streaks.renderOrder = 3;
    this.streaks = streaks; this.mesh.add(streaks);
    this.setDrop(this.drop);
  }
  private readonly murky = new THREE.Color(0x4f6d64);
  private readonly clear = new THREE.Color(0x4fb8cc);
  private centre: (Point & { w: number; top: number })[] = [];
  private streaks!: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  /** Advance the flow streaks; storm water barely moves, restored water runs. */
  update(t: number): void {
    const n = this.centre.length, flow = (CREEK_WATER_DROP.storm - this.drop) / (CREEK_WATER_DROP.storm - CREEK_WATER_DROP.flowing);
    const speed = 1.2 + Math.max(0, flow) * 2.6;
    for (let i = 0; i < this.streaks.count; i++) {
      const s = ((rand(i, 1.3) * n + t * speed * 2) % (n - 2));
      const k = Math.floor(s), f = s - k, a = this.centre[k]!, b = this.centre[k + 1]!;
      const x = a.x + (b.x - a.x) * f, z = a.z + (b.z - a.z) * f, lane = (rand(i, 4.4) - 0.5) * a.w * 1.3;
      const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
      this.dummy.position.set(x - dz / l * lane, a.top + (b.top - a.top) * f - this.drop + 0.03 - this.mesh.position.y, z + dx / l * lane);
      this.dummy.rotation.set(0, -Math.atan2(dz, dx), 0);
      this.dummy.scale.set(0.6 + rand(i, 9.1) * 0.8, 1, 1);
      this.dummy.updateMatrix(); this.streaks.setMatrixAt(i, this.dummy.matrix);
    }
    this.streaks.instanceMatrix.needsUpdate = true;
    (this.streaks.material as THREE.MeshBasicMaterial).opacity = 0.12 + Math.max(0, flow) * 0.45;
  }
  setDrop(drop: number): void {
    this.drop = drop;
    // Storm water is low and murky; restored flow runs higher and clear.
    const flow = (CREEK_WATER_DROP.storm - drop) / (CREEK_WATER_DROP.storm - CREEK_WATER_DROP.flowing);
    ((this.mesh.material as THREE.Material[])[0] as THREE.MeshStandardMaterial).color.copy(this.murky).lerp(this.clear, Math.min(1, Math.max(0, flow)));
    const p = this.mesh.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) p.setY(i, this.land[i]! - drop * this.dropScale[i]! + (i >= this.foamStart ? 0.015 : 0));
    p.needsUpdate = true;
  }
  get current(): number { return this.drop; }
}

// ——— Decor placement ———
interface Placed { kind: string; x: number; z: number; y: number; seed: number; scale: number; collider?: number; height?: number }

function clearOf(p: Point, extra = 0): boolean {
  if (isWet(p.x, p.z) || coastDistance(p.x, p.z) < 1.4) return false;
  for (const id of SITE_IDS) if (Math.hypot(p.x - SITE_ANCHORS[id]!.x, p.z - SITE_ANCHORS[id]!.z) < PAD_RADIUS[id]! + 1.6 + extra) return false;
  if (Math.hypot(p.x - SPAWN.x, p.z - SPAWN.z) < 3.6 || Math.hypot(p.x - COMMONS.x, p.z - COMMONS.z) < 4.2) return false;
  if (Math.hypot(p.x - FORD.x, p.z - FORD.z) < FORD_RADIUS + 1.2) return false;
  if (Math.abs(p.x - PIER.x) < PIER.halfWidth + 1.5 && p.z > PIER.fromZ - 2) return false;
  const c = creekInfo(p);
  return c.d > c.w + 1.1;
}
const slopeAt = (x: number, z: number) => Math.hypot(groundHeight(x + 0.3, z) - groundHeight(x - 0.3, z), groundHeight(x, z + 0.3) - groundHeight(x, z - 0.3)) / 0.6;

const ROOFS = [PALETTE.roofRed, PALETTE.roofTeal, PALETTE.roofOchre, PALETTE.roofTeal];
const HUTS = HOUSES.map((h, i) => ({ ...h, roof: ROOFS[i]! }));

function scatter(): Placed[] {
  const out: Placed[] = [];
  const hutClear = (p: Point) => HUTS.every(h => Math.hypot(p.x - h.x, p.z - h.z) > 3);
  let seed = 1;
  for (let x = BOUNDS.minX; x <= BOUNDS.maxX; x += 1.9) for (let z = BOUNDS.minZ; z <= BOUNDS.maxZ; z += 1.9) {
    seed++;
    const p = { x: x + (rand(x, z) - 0.5) * 1.8, z: z + (rand(z, x) - 0.5) * 1.8 };
    if (!clearOf(p) || !hutClear(p) || pathDistance(p) < 1.8) continue;
    // Keep the gull ledge under the windmill's bluff pad open so its nests read from above.
    if (Math.hypot(p.x - GULL_LEDGE.x, p.z - GULL_LEDGE.z) < 3.4) continue;
    if (Object.values(WINDMILL_PADS).some(pad => Math.hypot(p.x - pad.x, p.z - pad.z) < 2)) continue;
    const y = groundHeight(p.x, p.z), coast = coastDistance(p.x, p.z), r = rand(p.x * 1.7, p.z * 2.3), slope = slopeAt(p.x, p.z);
    // Ledge faces get boulders that break up the rock bands; otherwise keep plants off steep ground.
    if (slope > 0.55) { if (r < 0.45 && slope < 1.6) out.push({ kind: 'boulder', ...p, y, seed, scale: 0.9 + rand(p.z, p.x) * 0.6, collider: 0.45, height: 0.8 }); continue; }
    // Groves: a low-frequency mask clusters trees into masses with clearings between them.
    const grove = smoothstep(0.42, 0.62, fbm(p.x * 0.11 + 5, p.z * 0.11 - 3));
    const wood = p.z < -5 && y > 1.1 && y < 3.4, upland = y >= 3, beachy = coast < 9 && y < 1.1;
    let kind: string | null = null;
    if (beachy) kind = r < 0.36 ? 'palm' : r < 0.5 ? 'bush' : r < 0.56 ? 'rock' : r < 0.66 ? 'fern' : null;
    else if (upland) kind = r < 0.3 + grove * 0.35 ? 'pine' : r < 0.72 ? 'fern' : r < 0.8 ? 'rock' : r < 0.88 ? 'bush' : null;
    else if (wood) kind = r < 0.35 + grove * 0.3 ? 'tree' : r < 0.78 ? 'pine' : r < 0.9 ? 'fern' : r < 0.96 ? 'bush' : null;
    else kind = r < grove * 0.55 ? 'tree' : r < grove * 0.55 + 0.12 ? 'bush' : r < grove * 0.55 + 0.26 ? 'fern' : r < grove * 0.55 + 0.29 ? 'rock' : r < grove * 0.55 + 0.33 && coast < 14 ? 'palm' : null;
    if (!kind) continue;
    // Inside groves trees grow tall (6-9 m) so canopies merge into masses.
    const scale = (kind === 'tree' || kind === 'pine') ? 1.2 + grove * 1.3 + rand(p.z, p.x * 3) * 0.4 : 0.85 + rand(p.z, p.x * 3) * 0.4;
    const collider = kind === 'palm' ? 0.24 : kind === 'tree' ? 0.3 * scale : kind === 'pine' ? 0.26 * scale : kind === 'rock' && scale > 0.95 ? 0.42 * scale : undefined;
    if (kind === 'tree' || kind === 'pine') {
      // Undergrowth at the foot of trees so canopies read as grounded masses.
      for (let u = 0; u < 2; u++) {
        const a = r * 9 + u * 2.6, q = { x: p.x + Math.cos(a) * 1.1, z: p.z + Math.sin(a) * 1.1 };
        if (clearOf(q, -0.8) && pathDistance(q) > 1.4 && slopeAt(q.x, q.z) < 0.5) out.push({ kind: u ? 'fern' : 'bush', ...q, y: groundHeight(q.x, q.z), seed: seed * 3 + u, scale: 0.8 + rand(q.x, q.z) * 0.3 });
      }
    }
    const height = kind === 'palm' ? 4 : kind === 'tree' ? 3 : kind === 'pine' ? 3.2 : kind === 'rock' ? 0.6 : 0.6;
    out.push({ kind, ...p, y, seed, scale, ...(collider ? { collider, height } : {}) });
  }
  // Grass tufts everywhere dry and gentle, never colliding.
  for (let x = BOUNDS.minX; x <= BOUNDS.maxX; x += 1.35) for (let z = BOUNDS.minZ; z <= BOUNDS.maxZ; z += 1.35) {
    const p = { x: x + (rand(x * 2, z) - 0.5), z: z + (rand(z * 2, x) - 0.5) };
    if (rand(p.x * 5, p.z * 5) > 0.32 || isWet(p.x, p.z) || coastDistance(p.x, p.z) < 3 || pathDistance(p) < 1.1 || slopeAt(p.x, p.z) > 0.6) continue;
    if (Object.values(SITE_ANCHORS).some(s => Math.hypot(p.x - s.x, p.z - s.z) < 3.2)) continue;
    out.push({ kind: 'tuft', ...p, y: groundHeight(p.x, p.z), seed: Math.floor(p.x * 13 + p.z * 7), scale: 0.8 + rand(p.x, p.z) * 0.5 });
  }
  // Reeds along the lower creek: the nursery the pump and sluice must protect.
  for (let i = 3; i < CREEK.length - 1; i++) {
    const a = CREEK[i]!, b = CREEK[i + 1]!, len = Math.hypot(b.x - a.x, b.z - a.z);
    for (let s = 0; s < len; s += 0.8) for (const side of [-1, 1]) {
      const t = s / len, w = a.w + (b.w - a.w) * t, nx = -(b.z - a.z) / len, nz = (b.x - a.x) / len;
      const off = w + 0.25 + rand(s, i * side) * 0.9;
      const p = { x: a.x + (b.x - a.x) * t + nx * off * side, z: a.z + (b.z - a.z) * t + nz * off * side };
      if (rand(p.x, p.z * 3) > 0.62 || coastDistance(p.x, p.z) < 0.5 || groundHeight(p.x, p.z) < 0.05) continue;
      if (Math.abs(p.x - SITE_ANCHORS.creek_bridge!.x) < 5 && Math.abs(p.z - SITE_ANCHORS.creek_bridge!.z) < 2) continue;
      out.push({ kind: 'reeds', ...p, y: groundHeight(p.x, p.z), seed: Math.floor(s * 10 + i), scale: 0.9 + rand(p.z, s) * 0.4 });
    }
  }
  return out;
}

function pieceSet(kind: string, seed: number): Piece[] {
  switch (kind) {
    case 'palm': return palm(seed);
    case 'tree': return roundTree(seed);
    case 'pine': return pine(seed);
    case 'bush': return bush(seed);
    case 'rock': return rock(seed, 0.55);
    case 'boulder': return rock(seed, 0.85);
    case 'fern': return fern(seed);
    case 'reeds': return reeds(seed);
    default: return grassTuft(seed);
  }
}

const octagon = (x: number, z: number, r: number) => Array.from({ length: 8 }, (_, i) => ({ x: x + Math.cos(i * Math.PI / 4) * r, z: z + Math.sin(i * Math.PI / 4) * r }));
const footprintObstacle = (id: string, footprint: { x: number; z: number }[], minY: number, maxY: number): Obstacle => ({
  id, footprint, minY, maxY,
  minX: Math.min(...footprint.map(p => p.x)), maxX: Math.max(...footprint.map(p => p.x)),
  minZ: Math.min(...footprint.map(p => p.z)), maxZ: Math.max(...footprint.map(p => p.z)),
});
const matrixAt = (x: number, y: number, z: number, ry: number, s: number) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, s, s));

function decorMesh(name: string, geometry: THREE.BufferGeometry, shadows = true): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 }));
  mesh.name = name; mesh.castShadow = shadows; mesh.receiveShadow = true; mesh.userData.category = 'foliage';
  return mesh;
}

/** Builds the stylized island and its walk/collision data from one shared description. */
export function buildStylizedIsland(): StylizedWorld {
  const group = new THREE.Group(); group.name = 'stylized-island';
  const scope = new THREE.Group(); scope.name = 'island-cutaway-scope';
  const backdrop = new THREE.Group(); backdrop.name = 'island-backdrop';
  group.add(scope, backdrop);

  const terrain = terrainMesh();
  scope.add(terrain.mesh);
  const triangles = [...terrain.walk];
  const obstacles: Obstacle[] = [];

  // Pier: a walkable deck out over the bay, always open.
  // Deck clears the highest sand under its first metres; its land end starts where the beach meets deck height.
  let pierY = 0; for (let z = PIER.fromZ; z < PIER.fromZ + 4; z += 0.25) for (const dx of [-PIER.halfWidth, 0, PIER.halfWidth]) pierY = Math.max(pierY, groundHeight(PIER.x + dx, z) + 0.15);
  const pierStart = PIER.fromZ;
  const pierLength = PIER.toZ - pierStart;
  const pierGeo = bake(pier(pierLength, PIER.halfWidth), matrixAt(PIER.x, pierY, pierStart, 0, 1));
  for (let z = pierStart - 0.4; z < PIER.toZ - 0.01; z += 1) {
    const z2 = Math.min(PIER.toZ, z + 1), x0 = PIER.x - PIER.halfWidth + 0.15, x1 = PIER.x + PIER.halfWidth - 0.15;
    const a = { x: x0, y: pierY, z }, b = { x: x1, y: pierY, z }, c = { x: x0, y: pierY, z: z2 }, d = { x: x1, y: pierY, z: z2 };
    triangles.push({ id: `pier:${z.toFixed(1)}:a`, a, b: c, c: d, biome: 'pier' }, { id: `pier:${z.toFixed(1)}:b`, a, b: d, c: b, biome: 'pier' });
  }

  // The pier's visible railings are solid, so the deck is left from its land end.
  for (const side of [-1, 1]) {
    const x = PIER.x + side * (PIER.halfWidth - 0.06), z0 = PIER.fromZ + 0.3;
    obstacles.push(footprintObstacle(`pier-rail:${side}`, [{ x: x - 0.06, z: z0 }, { x: x + 0.06, z: z0 }, { x: x + 0.06, z: PIER.toZ }, { x: x - 0.06, z: PIER.toZ }], pierY - 0.3, pierY + 0.6));
  }
  obstacles.push(footprintObstacle('pier-end-rail', [{ x: PIER.x - PIER.halfWidth, z: PIER.toZ - 0.06 }, { x: PIER.x + PIER.halfWidth, z: PIER.toZ - 0.06 }, { x: PIER.x + PIER.halfWidth, z: PIER.toZ + 0.1 }, { x: PIER.x - PIER.halfWidth, z: PIER.toZ + 0.1 }], pierY - 0.3, pierY + 0.6));

  // Bridge deck strip: walkable only once the creek bridge is restored.
  const bridge = SITE_ANCHORS.creek_bridge!, bridgePad = landHeight(bridge.x, bridge.z), deckY = bridgePad + BRIDGE_DECK.lift;
  for (let x = BRIDGE_DECK.minX; x < BRIDGE_DECK.maxX - 0.01; x += 1) {
    const x2 = Math.min(BRIDGE_DECK.maxX, x + 1);
    const a = { x, y: deckY, z: BRIDGE_DECK.minZ }, b = { x: x2, y: deckY, z: BRIDGE_DECK.minZ }, c = { x, y: deckY, z: BRIDGE_DECK.maxZ }, d = { x: x2, y: deckY, z: BRIDGE_DECK.maxZ };
    triangles.push({ id: `bridge-deck:${x}:a`, a, b: c, c: d, biome: 'bridge', requires: ['creek_bridge'] }, { id: `bridge-deck:${x}:b`, a, b: d, c: b, biome: 'bridge', requires: ['creek_bridge'] });
  }

  // Village huts, the commons fire pit and ford stones.
  const statics: THREE.BufferGeometry[] = [pierGeo];
  for (const [i, h] of HUTS.entries()) {
    const y = groundHeight(h.x, h.z);
    statics.push(bake(house(i % 4, h.roof, i), matrixAt(h.x, y, h.z, h.ry, 1)));
    const c = Math.cos(h.ry), s = Math.sin(h.ry), hw = 1.5, hd = i % 4 === 0 ? 1.7 : 1.2;
    const fp = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, w]) => ({ x: h.x + u! * c + w! * s, z: h.z - u! * s + w! * c }));
    obstacles.push(footprintObstacle(`hut:${i}`, fp, y, y + 3));
  }
  // The village trough (always there; dry until the pump runs) is solid.
  const troughY = groundHeight(TROUGH.x, TROUGH.z);
  {
    const c = Math.cos(TROUGH.ry), s = Math.sin(TROUGH.ry), fp = [[-0.85, -0.34], [0.7, -0.34], [0.7, 0.34], [-0.85, 0.34]].map(([u, w]) => ({ x: TROUGH.x + u! * c + w! * s, z: TROUGH.z - u! * s + w! * c }));
    obstacles.push(footprintObstacle('village-trough', fp, troughY, troughY + 1.1));
  }
  statics.push(bake(firePit(), matrixAt(COMMONS.x, groundHeight(COMMONS.x, COMMONS.z), COMMONS.z, 0, 1)));
  obstacles.push(footprintObstacle('commons-fire', octagon(COMMONS.x, COMMONS.z, 0.85), groundHeight(COMMONS.x, COMMONS.z), groundHeight(COMMONS.x, COMMONS.z) + 0.6));
  // The council sits here; their mats are solid so the restorer walks around them.
  for (const [role, seat] of Object.entries(COUNCIL_SEATS)) obstacles.push(footprintObstacle(`council-seat:${role}`, octagon(seat.x, seat.z, 0.42), groundHeight(seat.x, seat.z), groundHeight(seat.x, seat.z) + 1.2));
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9 + 0.3, r = 0.4 + (i % 3) * 0.55;
    const x = FORD.x + Math.cos(a) * r * 1.2, z = FORD.z + Math.sin(a) * r;
    statics.push(bake(rock(i + 50, 0.32), matrixAt(x, groundHeight(x, z) - 0.05, z, a, 1)));
  }

  // Trees, rocks, bushes, grass and reeds.
  const placed = scatter();
  const foliage: THREE.BufferGeometry[] = [], small: THREE.BufferGeometry[] = [];
  for (const [i, p] of placed.entries()) {
    const g = bake(pieceSet(p.kind, p.seed), matrixAt(p.x, p.y - 0.04, p.z, rand(p.x, p.z) * Math.PI * 2, p.scale));
    (p.kind === 'tuft' || p.kind === 'reeds' || p.kind === 'fern' ? small : foliage).push(g);
    if (p.collider) obstacles.push(footprintObstacle(`decor:${p.kind}:${i}`, octagon(p.x, p.z, p.collider), p.y, p.y + (p.height ?? 1)));
  }
  const foliageMesh = decorMesh('island-foliage', concat(foliage));
  const smallMesh = decorMesh('island-grass', concat(small), false);
  const staticMesh = decorMesh('island-structures', concat(statics));
  staticMesh.userData.category = 'structure';
  // Buildings and the pier never cut away; only foliage dissolves when it truly covers the restorer.
  scope.add(foliageMesh, smallMesh);
  backdrop.add(staticMesh);
  const foliageRecovery = new Recovery(foliageMesh.geometry.getAttribute('color') as THREE.BufferAttribute, foliageMesh.geometry.getAttribute('lushColor') as THREE.BufferAttribute, foliageMesh.geometry.getAttribute('position') as THREE.BufferAttribute, 0.25);
  const smallRecovery = new Recovery(smallMesh.geometry.getAttribute('color') as THREE.BufferAttribute, smallMesh.geometry.getAttribute('lushColor') as THREE.BufferAttribute, smallMesh.geometry.getAttribute('position') as THREE.BufferAttribute, 0.25);

  // Per-site storm debris (cleared on restoration) and flowers (bloom on restoration).
  const siteDebris = new Map<string, THREE.Mesh>(), siteFlowers = new Map<string, THREE.Mesh>();
  for (const [s, id] of SITE_IDS.entries()) {
    const anchor = SITE_ANCHORS[id]!, junk: THREE.BufferGeometry[] = [], bloom: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 40 && (junk.length < 3 || bloom.length < 9); k++) {
      const a = rand(s * 9 + k, k * 1.3) * Math.PI * 2, r = PAD_RADIUS[id]! + 0.6 + rand(k, s * 7) * 6;
      const p = { x: anchor.x + Math.cos(a) * r, z: anchor.z + Math.sin(a) * r };
      if (!clearOf(p, -1.2) || pathDistance(p) < 1.2 || slopeAt(p.x, p.z) > 0.5) continue;
      const y = groundHeight(p.x, p.z);
      if (junk.length < 3 && k % 3 === 0) junk.push(bake(debris(k + s), matrixAt(p.x, y, p.z, a, 1)));
      else if (bloom.length < 9) bloom.push(bake(flowers(k * 7 + s), matrixAt(p.x, y, p.z, a, 1)));
    }
    if (junk.length) { const m = decorMesh(`storm-debris:${id}`, concat(junk)); siteDebris.set(id, m); scope.add(m); }
    if (bloom.length) { const m = decorMesh(`flowers:${id}`, concat(bloom), false); m.visible = false; siteFlowers.set(id, m); scope.add(m); }
  }

  const sea = new Sea(), creek = new Creek();
  const posts: { x: number; z: number; r: number }[] = [];
  for (let z = 0.4; z < PIER.toZ - PIER.fromZ; z += 2.2) for (const x of [-PIER.halfWidth + 0.12, PIER.halfWidth - 0.12]) if (groundHeight(PIER.x + x, PIER.fromZ + z) < 0) posts.push({ x: PIER.x + x, z: PIER.fromZ + z, r: 0.16 });
  // Rocks standing in the shallows, each wrapped in foam.
  const shallows: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 70; i++) {
    const a = rand(i, 11.3) * Math.PI * 2 - Math.PI;
    let r = shoreRadius(a);
    r += 0.4 + rand(i, 12.7) * 1.8;
    const x = ISLAND_CENTRE.x + Math.cos(a) * r, z = ISLAND_CENTRE.z + Math.sin(a) * r;
    if ((Math.abs(x - PIER.x) < 4 && z > PIER.fromZ - 3) || Math.hypot(x - SITE_ANCHORS.tidal_sluice!.x, z - SITE_ANCHORS.tidal_sluice!.z) < 7) continue;
    const size = 0.35 + rand(i, 13.9) * 0.55;
    // Seated so roughly the top third breaks the surface.
    shallows.push(bake(rock(i + 300, size * 1.3), matrixAt(x, -0.5 * size, z, a, 1)));
    posts.push({ x, z, r: size * 0.95 });
  }
  if (shallows.length) scope.add(decorMesh('shallow-rocks', concat(shallows)));
  sea.addPostFoam(posts);
  backdrop.add(sea.group, creek.mesh);
  const pumpAt = SITE_ANCHORS.village_pump!;
  const village = new VillageLife(HUTS.map((h, i) => ({ x: h.x, y: groundHeight(h.x, h.z), z: h.z, ry: h.ry, variant: i % 4 })), { ...TROUGH, y: troughY }, { x: pumpAt.x, y: groundHeight(pumpAt.x, pumpAt.z), z: pumpAt.z }, groundHeight);
  backdrop.add(village.group);
  // A signpost on the bridge's west-bank landing, where the bridge (not the pump) is in focus and
  // can be inspected. The deck itself stays closed until a finalized approval.
  {
    const landing = new THREE.Group(); landing.name = 'bridge-landing';
    const at = { x: -7.05, z: -0.05 }, y = groundHeight(at.x, at.z);
    landing.position.set(at.x, y, at.z); backdrop.add(landing);
    const k = new Kit(landing, false);
    const post = { x: -0.15, z: -1.25 };
    k.box(0.09, 1.25, 0.09, 'timberDark', post.x, 0.62, post.z);
    k.box(0.62, 0.2, 0.05, 'timber', post.x + 0.22, 1.08, post.z, 0, 0, 0);
    k.box(0.16, 0.16, 0.05, 'timber', post.x + 0.58, 1.08, post.z, 0, 0, Math.PI / 4);
    k.box(0.36, 0.05, 0.06, 'blue', post.x + 0.14, 1.08, post.z + 0.03);
    obstacles.push(footprintObstacle('bridge-landing-sign', octagon(at.x + post.x, at.z + post.z, 0.12), y, y + 1.3));
  }

  // Recovery animation state: each site eases from storm to restored when its grant lands.
  const levels = SITE_IDS.map(() => 0);
  let calm = 0, dirty = true;
  const update: EnvironmentUpdate = (seconds, restored, dt) => {
    sea.update(seconds);
    creek.update(seconds);
    const step = Math.min(1, dt / 3.2);
    SITE_IDS.forEach((id, i) => {
      const target = restored.has(id) ? 1 : 0;
      if (levels[i] !== target) { levels[i] = target > levels[i]! ? Math.min(1, levels[i]! + step) : Math.max(0, levels[i]! - step); dirty = true; }
      const ease = levels[i]! * levels[i]! * (3 - 2 * levels[i]!);
      const junk = siteDebris.get(id);
      if (junk) { junk.visible = ease < 0.98; junk.scale.setScalar(1); junk.position.y = -ease * 0.6; }
      const bloom = siteFlowers.get(id);
      if (bloom) { bloom.visible = ease > 0.02; bloom.scale.set(1, Math.max(0.01, ease), 1); }
    });
    const targetCalm = restored.size / SITE_IDS.length;
    if (Math.abs(calm - targetCalm) > 0.001) { calm += Math.sign(targetCalm - calm) * Math.min(Math.abs(targetCalm - calm), step); dirty = true; }
    // Water returns to the creek when the spring pump, waterworks or sluice is working.
    const flow = Math.max(levels[SITE_IDS.indexOf('village_pump')]!, levels[SITE_IDS.indexOf('upland_waterworks')]!, levels[SITE_IDS.indexOf('tidal_sluice')]! * 0.7);
    const drop = CREEK_WATER_DROP.storm + (CREEK_WATER_DROP.flowing - CREEK_WATER_DROP.storm) * flow;
    if (Math.abs(drop - creek.current) > 0.002) creek.setDrop(drop);
    const pumpLevel = levels[SITE_IDS.indexOf('village_pump')]!;
    village.update(pumpLevel * pumpLevel * (3 - 2 * pumpLevel), seconds);
    if (dirty) {
      const eased = levels.map(l => l * l * (3 - 2 * l));
      terrain.recovery.apply(eased, calm); foliageRecovery.apply(eased, calm); smallRecovery.apply(eased, calm);
      dirty = false;
    }
  };
  group.userData.update = update;
  // The renderer names the installed pump design (display only) so the village shows its marks.
  group.userData.setVillageDesign = (design: VillageDesign) => village.setDesign(design);
  group.userData.ownsWater = true;
  group.userData.occluders = [staticMesh];
  // Depth haze: distant (upper-screen) terrain softens toward the sky colour.
  group.userData.fog = [92, 175];
  group.userData.environment = ISLAND_LEVEL_ID;

  // Repair-site equipment dressing, matching the previous environment's kits.
  const sitePositions: Record<string, Vec3> = {};
  for (const [id, p] of Object.entries(SITE_ANCHORS))
    sitePositions[id] = { x: p.x, // The bridge root sits so its authored deck top (root + 0.29 m) meets the walk deck.
    y: id === 'creek_bridge' ? deckY - 0.29 : groundHeight(p.x, p.z), z: p.z };
  const kinds: Readonly<Record<string, RepairDressing['kind'][]>> = { pier_hoist: ['workbench', 'resource-planks'], village_pump: ['barrel', 'box-large'], tidal_sluice: ['barrel', 'box'], creek_bridge: [], coast_windmill: ['barrel'], woodland_pathlight: ['signpost'], upland_waterworks: ['barrel', 'box-large'], ridge_beacon: ['box-large'] };
  const dressing: RepairDressing[] = [];
  // Equipment sits beside the work pad, never on a footpath or in the creek.
  // Keep a clear walkway (about 1 m) between the work bench and its equipment.
  const offsets: readonly [number, number][] = [[-3.7, -1.5], [3.7, -1.5], [-3.7, 1.5], [3.7, 1.5], [0, -3], [-3.9, 0], [3.9, 0]];
  for (const site of SITE_PLAN) {
    const p = sitePositions[site.id]!, free = offsets.filter(([dx, dz]) => pathDistance({ x: p.x + dx, z: p.z + dz }) > 1.7 && !isWet(p.x + dx, p.z + dz));
    for (const [k, kind] of (kinds[site.id] ?? []).entries()) {
      const [dx, dz] = free[k] ?? offsets[k]!, x = p.x + dx, z = p.z + dz;
      // Loose stock is loaded once the site is restored.
      dressing.push({ id: `island-prop:${site.id}:${k}`, siteId: site.id, kind, position: { x, y: groundHeight(x, z), z }, requires: [], ...(kind === 'resource-planks' ? { untilRestored: site.id } : {}) });
    }
  }

  const draft: LevelData = {
    id: ISLAND_LEVEL_ID,
    spawn: { x: SPAWN.x, y: groundHeight(SPAWN.x, SPAWN.z), z: SPAWN.z },
    triangles: Object.freeze(triangles),
    obstacles: Object.freeze(obstacles),
    trees: [],
    visibleSiteIds: SITE_PLAN.map(s => s.id),
    sitePositions: Object.freeze(sitePositions),
    saveCompatibleLevelIds: ['imported-google-island-v1', 'island-stage-b-v1'],
    surfaceSelection: 'highest',
    bounds: { minX: BOUNDS.minX + 1, maxX: BOUNDS.maxX - 1, minZ: BOUNDS.minZ + 1, maxZ: BOUNDS.maxZ - 1 },
  };
  // Spawn height comes from the walk surface itself so saves and movement agree exactly.
  const level: LevelData = Object.freeze({ ...draft, spawn: { ...draft.spawn, y: sampleGround(draft, SPAWN.x, SPAWN.z)!.y } });
  return {
    group, level, dressing,
    stats: { environment: ISLAND_LEVEL_ID, walkTriangles: triangles.length, obstacles: obstacles.length, decor: placed.length, sitePositions, spawn: level.spawn },
  };
}
