import * as THREE from 'three';
import { BRIDGE_DECK, HOUSES, PATHS, PIER, SITE_ANCHORS, TROUGH, groundHeight, type Point } from '../../content/stylized-island';

// Presentation only. The island starts at night after the storm; each repair
// switches on lights you can see from across the island, and they matter less as
// the sky lightens toward morning:
//   Landing Hoist      lanterns along the pier          Spring Pump   lanterns at the trough
//   Reedbed Sluice     fireflies over the reeds         Bridge        lanterns at both deck ends
//   Headland Windmill  street lamps along every path    Fern Path     lanterns along the woodland path + fireflies
//   Ridge Cistern      lanterns on the ridge            Lookout Beacon a beam sweeping the sea (never inland)
// Lamps are shaded downward (habitat-friendly): a bright head and a pool on the ground.
// The village's window glow already follows the pump (village-life.ts).

const WARM = 0xffc979;
function poolTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!, r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,214,150,0.9)'); r.addColorStop(0.45, 'rgba(255,190,110,0.35)'); r.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const pool = typeof document !== 'undefined' ? poolTexture() : null;
const postMaterial = new THREE.MeshStandardMaterial({ color: 0x3b3029, flatShading: true, roughness: 0.8 });
const capMaterial = new THREE.MeshStandardMaterial({ color: 0x2d2622, flatShading: true, roughness: 0.7 });

interface Lamp { readonly head: THREE.MeshBasicMaterial; readonly pool: THREE.MeshBasicMaterial; readonly group: THREE.Group }
interface SiteLights { readonly lamps: Lamp[]; readonly flies: THREE.Points[]; level: number; beam?: THREE.Group }

function lamp(at: Point, height = 1.35, y = groundHeight(at.x, at.z)): Lamp {
  const group = new THREE.Group(); group.position.set(at.x, y, at.z); group.name = 'night-lamp';
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, height, 6), postMaterial); post.position.y = height / 2; post.castShadow = true; group.add(post);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.1, 8), capMaterial); cap.position.y = height + 0.06; group.add(cap);
  const head = new THREE.MeshBasicMaterial({ color: WARM, transparent: true, opacity: 0.25 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), head); bulb.position.y = height - 0.02; group.add(bulb);
  const poolMaterial = new THREE.MeshBasicMaterial({ map: pool, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2), poolMaterial); disc.position.y = 0.04; disc.renderOrder = 2; group.add(disc);
  return { head, pool: poolMaterial, group };
}

function fireflies(centre: Point, radius: number, count: number, seed: number): THREE.Points {
  const positions = new Float32Array(count * 3), base = groundHeight(centre.x, centre.z);
  for (let i = 0; i < count; i++) {
    const a = ((i * 2.399 + seed) % (Math.PI * 2)), r = radius * Math.sqrt(((i * 0.618 + seed * 0.1) % 1));
    positions[i * 3] = centre.x + Math.cos(a) * r; positions[i * 3 + 2] = centre.z + Math.sin(a) * r;
    positions[i * 3 + 1] = Math.max(base, groundHeight(positions[i * 3]!, positions[i * 3 + 2]!)) + 0.4 + (i % 5) * 0.18;
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xf6ff9a, size: 0.12, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const points = new THREE.Points(geometry, material); points.userData.base = positions.slice(); points.name = 'fireflies';
  return points;
}

/** Points every `step` metres along the island's paths, offset to the path's side and clear of buildings. */
function streetLampSpots(step: number): Point[] {
  const spots: Point[] = [];
  for (const line of PATHS) {
    let carry = step * 0.5;
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i]!, b = line[i + 1]!, len = Math.hypot(b.x - a.x, b.z - a.z);
      for (let d = carry; d < len; d += step) {
        const t = d / len, nx = -(b.z - a.z) / len, nz = (b.x - a.x) / len, side = spots.length % 2 ? 1 : -1;
        const p = { x: a.x + (b.x - a.x) * t + nx * 1.05 * side, z: a.z + (b.z - a.z) * t + nz * 1.05 * side };
        const clear = !HOUSES.some(h => Math.hypot(h.x - p.x, h.z - p.z) < 3) && !Object.values(SITE_ANCHORS).some(s => Math.hypot(s.x - p.x, s.z - p.z) < 3.5)
          && !spots.some(s => Math.hypot(s.x - p.x, s.z - p.z) < step * 0.7) && groundHeight(p.x, p.z) > 0.3;
        if (clear) spots.push(p);
      }
      carry = Math.max(0, (carry - len) % step);
    }
  }
  return spots;
}

export class NightLights {
  readonly group = new THREE.Group();
  private readonly sites = new Map<string, SiteLights>();
  private time = 0;

  constructor() {
    this.group.name = 'night-lights';
    const at = (id: string, deg: number, r: number): Point => { const a = deg * Math.PI / 180, c = SITE_ANCHORS[id]!; return { x: c.x + Math.sin(a) * r, z: c.z + Math.cos(a) * r }; };
    let pierY = 0; for (let z = PIER.fromZ; z < PIER.fromZ + 4; z += 0.5) pierY = Math.max(pierY, groundHeight(PIER.x, z) + 0.15);
    const plan: Record<string, { lamps: Lamp[]; flies?: THREE.Points[] }> = {
      pier_hoist: { lamps: [6, 10, 14].flatMap(dz => [-1, 1].map(s => lamp({ x: PIER.x + s * (PIER.halfWidth - 0.1), z: PIER.fromZ + dz }, 1.2, pierY))) },
      village_pump: { lamps: [lamp({ x: TROUGH.x + 1.4, z: TROUGH.z - 0.6 }), lamp(at('village_pump', 300, 5.6))] },
      tidal_sluice: { lamps: [lamp(at('tidal_sluice', 210, 5))], flies: [fireflies(at('tidal_sluice', 20, 3), 3.2, 36, 1)] },
      creek_bridge: { lamps: [-1, 1].flatMap(s => [BRIDGE_DECK.minX - 0.3, BRIDGE_DECK.maxX + 0.3].map(x => lamp({ x, z: s * (BRIDGE_DECK.maxZ + 0.25) }, 1.15))) },
      coast_windmill: { lamps: streetLampSpots(7.5).map(p => lamp(p, 1.6)) },
      woodland_pathlight: { lamps: [0, 72, 144, 216, 288].map(d => lamp(at('woodland_pathlight', d, 5.4), 1.1)), flies: [fireflies(SITE_ANCHORS.woodland_pathlight!, 7, 46, 2)] },
      upland_waterworks: { lamps: [lamp(at('upland_waterworks', 40, 5)), lamp(at('upland_waterworks', 220, 5))] },
      ridge_beacon: { lamps: [] },
    };
    for (const [id, p] of Object.entries(plan)) {
      const lights: SiteLights = { lamps: p.lamps, flies: p.flies ?? [], level: 0 };
      for (const l of p.lamps) this.group.add(l.group);
      for (const f of lights.flies) this.group.add(f);
      this.sites.set(id, lights);
    }
    // The Lookout Beacon: a lamp and a soft beam that sweeps the sea.
    const beacon = SITE_ANCHORS.ridge_beacon!, by = groundHeight(beacon.x, beacon.z) + 2.6;
    const beam = new THREE.Group(); beam.position.set(beacon.x, by, beacon.z); beam.name = 'beacon-beam';
    // Bright at the lamp, fading to nothing out at sea (alpha per vertex along the beam).
    const coneGeometry = new THREE.ConeGeometry(4, 34, 24, 8, true).translate(0, -17, 0).rotateZ(Math.PI / 2);
    const along = coneGeometry.getAttribute('position'), fade = new Float32Array(along.count * 4);
    for (let i = 0; i < along.count; i++) { const t = Math.min(1, along.getX(i) / 34), a = Math.pow(1 - t, 1.6); fade.set([1, 0.95, 0.8, a], i * 4); }
    coneGeometry.setAttribute('color', new THREE.BufferAttribute(fade, 4));
    const cone = new THREE.Mesh(coneGeometry,
      new THREE.MeshBasicMaterial({ color: 0xfff1c4, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    cone.rotation.z = -0.08; beam.add(cone);
    const flare = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0 }));
    beam.add(flare);
    this.group.add(beam);
    this.sites.get('ridge_beacon')!.beam = beam;
  }

  /** daylight: 0 night … 1 morning. restored: the sites whose repairs are installed. */
  update(dt: number, daylight: number, restored: ReadonlySet<string>): void {
    this.time += dt;
    // Lamps still read at first light, then fade into the morning.
    const night = 1 - THREE.MathUtils.smoothstep(daylight, 0.7, 1);
    for (const [id, lights] of this.sites) {
      const target = restored.has(id) ? 1 : 0;
      lights.level += (target - lights.level) * Math.min(1, dt * 1.6);
      const on = lights.level;
      lights.lamps.forEach((l, i) => {
        // A short flicker as each lamp first catches.
        const catchUp = Math.min(1, Math.max(0, on * 1.6 - i * 0.04));
        l.head.opacity = 0.25 + catchUp * 0.75;
        l.head.color.setHex(catchUp > 0.5 ? WARM : 0x6d6253);
        l.pool.opacity = catchUp * night * 0.85;
      });
      for (const f of lights.flies) {
        (f.material as THREE.PointsMaterial).opacity = on * night * (0.65 + Math.sin(this.time * 3.1) * 0.2);
        const pos = f.geometry.getAttribute('position') as THREE.BufferAttribute, base = f.userData.base as Float32Array;
        for (let i = 0; i < pos.count; i++) {
          pos.setXYZ(i, base[i * 3]! + Math.sin(this.time * 0.7 + i) * 0.25, base[i * 3 + 1]! + Math.sin(this.time * 1.3 + i * 1.7) * 0.12, base[i * 3 + 2]! + Math.cos(this.time * 0.6 + i * 0.9) * 0.25);
        }
        pos.needsUpdate = true;
      }
      if (lights.beam) {
        // Swing across the sea to the north only: homes and nests inland stay dark.
        lights.beam.rotation.y = Math.PI / 2 + Math.sin(this.time * 0.38) * 1.05;
        const [cone, flare] = lights.beam.children as THREE.Mesh[];
        (cone!.material as THREE.MeshBasicMaterial).opacity = on * night * 0.32;
        (flare!.material as THREE.MeshBasicMaterial).opacity = on;
      }
    }
  }
}
