import * as THREE from 'three';
import { SERVICE_BOARD } from '../../content/service-layout';
import { socketPosition } from '../../content/assembly-layout';

// Presentation only: authored models for the village pump's fixture slots.
// Each part is built around its socket and carries its own support down to the
// platform, so any subset the player places still stands up physically.

const PLATFORM_TOP = SERVICE_BOARD.y + SERVICE_BOARD.height / 2;

export type Paint = 'stone' | 'flag' | 'timber' | 'timberDark' | 'iron' | 'ironDark' | 'red' | 'blue' | 'brass' | 'copper' | 'galv' | 'tin' | 'rubber' | 'mesh' | 'water' | 'gravel' | 'sand' | 'glass' | 'hoop' | 'rope' | 'canvas' | 'lamp' | 'cable' | 'reed' | 'mud';
const COLOURS: Record<Paint, number> = {
  stone: 0x9d9282, flag: 0xb4a994, timber: 0x9a6a40, timberDark: 0x5f3f27, iron: 0x60747a, ironDark: 0x415157,
  red: 0xc0472f, blue: 0x2f7fa6, brass: 0xd0a24e, copper: 0xc47a45, galv: 0xa3aeb0, tin: 0xb0563a,
  rubber: 0x26292b, mesh: 0xd9dfdc, water: 0x3f9db4, gravel: 0x8d8576, sand: 0xd8c08a, glass: 0x9fd3d8, hoop: 0x3a3f42,
  rope: 0xc9a46a, canvas: 0xe9dcc0, lamp: 0xffd98a, cable: 0x2e2a26, reed: 0x8c9a4a, mud: 0x6b5a44,
};
const METAL: ReadonlySet<Paint> = new Set(['iron', 'ironDark', 'brass', 'copper', 'galv', 'hoop']);
const materials = new Map<string, THREE.MeshStandardMaterial>();
export function paint(id: Paint, worn = false): THREE.MeshStandardMaterial {
  const key = `${id}:${worn}`;
  let m = materials.get(key);
  if (!m) {
    const colour = new THREE.Color(COLOURS[id]);
    // Storm damage: painted and bright metal goes rust-brown and dull.
    if (worn && !['stone', 'flag', 'gravel', 'sand', 'water', 'rubber', 'rope', 'cable', 'reed', 'mud'].includes(id)) colour.lerp(new THREE.Color(0x7d4a2e), id === 'timber' || id === 'timberDark' ? 0.25 : 0.55);
    m = new THREE.MeshStandardMaterial({
      color: colour, flatShading: true, roughness: worn ? 0.95 : METAL.has(id) ? 0.48 : 0.86, metalness: !worn && METAL.has(id) ? 0.35 : 0,
      ...(id === 'mesh' ? { wireframe: true } : {}),
      ...(id === 'glass' ? { transparent: true, opacity: 0.55 } : {}),
      ...(id === 'water' ? { roughness: 0.2, emissive: new THREE.Color(0x0e3a48), emissiveIntensity: 0.4 } : {}),
      ...(id === 'lamp' ? { emissive: new THREE.Color(worn ? 0x000000 : 0xffb347), emissiveIntensity: worn ? 0 : 0.9 } : {}),
    });
    materials.set(key, m);
  }
  return m;
}

export class Kit {
  constructor(readonly group: THREE.Group, readonly worn: boolean) {}
  add(geometry: THREE.BufferGeometry, id: Paint, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, paint(id, this.worn));
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = mesh.receiveShadow = id !== 'mesh';
    this.group.add(mesh);
    return mesh;
  }
  box(w: number, h: number, d: number, id: Paint, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { return this.add(new THREE.BoxGeometry(w, h, d), id, x, y, z, rx, ry, rz); }
  cyl(rt: number, rb: number, h: number, id: Paint, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 10) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), id, x, y, z, rx, ry, rz); }
  /** Horizontal pipe along x. */
  pipeX(r: number, len: number, id: Paint, x = 0, y = 0, z = 0) { return this.cyl(r, r, len, id, x, y, z, 0, 0, Math.PI / 2); }
  /** Horizontal pipe along z. */
  pipeZ(r: number, len: number, id: Paint, x = 0, y = 0, z = 0) { return this.cyl(r, r, len, id, x, y, z, Math.PI / 2, 0, 0); }
  flangeX(r: number, id: Paint, x: number, y = 0, z = 0) { return this.cyl(r, r, 0.04, id, x, y, z, 0, 0, Math.PI / 2, 8); }
  ring(r: number, tube: number, id: Paint, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { return this.add(new THREE.TorusGeometry(r, tube, 5, 14), id, x, y, z, rx, ry, rz); }
  sphere(r: number, id: Paint, x = 0, y = 0, z = 0, sy = 1) { const m = this.add(new THREE.SphereGeometry(r, 10, 7), id, x, y, z); m.scale.y = sy; return m; }
  /** Half-round gutter trough along x. */
  halfpipe(len: number) {
    const material = paint('galv', this.worn).clone(); material.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len, 10, 1, true, 0, Math.PI), material);
    mesh.rotation.set(Math.PI / 2, 0, Math.PI / 2); mesh.castShadow = mesh.receiveShadow = true;
    this.group.add(mesh); return mesh;
  }
  rock(r: number, x: number, y: number, z: number, ry: number) { const m = this.add(new THREE.DodecahedronGeometry(r, 0), 'stone', x, y, z, 0.4, ry, 0.2); m.scale.set(1.3, 0.75, 1.1); return m; }
  cone(r: number, h: number, y: number) { return this.add(new THREE.ConeGeometry(r, h, 14), 'tin', 0, y, 0); }
  /** A post from the platform up to local height y. */
  post(x: number, z: number, floor: number, top: number, id: Paint = 'timberDark', w = 0.07) { return this.box(w, top - floor, w, id, x, (top + floor) / 2, z); }
  /** A small cradle stand from the platform up to a pipe or body at local y. */
  saddle(x: number, z: number, floor: number, top: number) {
    this.box(0.16, 0.05, 0.16, 'stone', x, floor + 0.025, z);
    this.box(0.05, top - floor - 0.05, 0.05, 'ironDark', x, (top + floor) / 2 + 0.025, z);
  }
}

/** Gate valve body with a hand wheel on top; the wheel turns with the setting. */
export function valve(k: Kit, floor: number, wheel: Paint) {
  k.pipeX(0.075, 0.46, 'iron'); k.flangeX(0.11, 'iron', -0.21); k.flangeX(0.11, 'iron', 0.21);
  k.box(0.18, 0.2, 0.17, 'iron', 0, 0.02, 0);
  k.cyl(0.03, 0.03, 0.22, 'galv', 0, 0.2, 0);
  const handle = new THREE.Group(); handle.name = 'handle'; handle.position.y = 0.31; k.group.add(handle);
  const hk = new Kit(handle, false);
  hk.ring(0.13, 0.022, wheel, 0, 0, 0, Math.PI / 2);
  hk.box(0.24, 0.02, 0.025, wheel); hk.box(0.025, 0.02, 0.24, wheel);
  hk.cyl(0.018, 0.018, 0.09, 'timber', 0.13, 0.05, 0);
  k.saddle(0, 0, floor, -0.08);
}

/** Builds one part around its socket; floor is the platform top in the part's local space. */
export type PartBuilder = (k: Kit, floor: number, facts: Readonly<Record<string, number | string>>) => void;

export const PUMP_PARTS: Readonly<Record<string, PartBuilder>> = {
  // Intake: a mesh basket standing in a stone sump of dark water.
  screen(k, floor) {
    k.box(0.62, 0.3, 0.62, 'stone', 0, floor + 0.15, 0);
    k.box(0.5, 0.02, 0.5, 'water', 0, floor + 0.29, 0);
    k.cyl(0.17, 0.17, 0.42, 'mesh', 0, floor + 0.42, 0, 0, 0, 0, 12);
    k.ring(0.17, 0.018, 'galv', 0, floor + 0.62, 0, Math.PI / 2);
    k.ring(0.17, 0.018, 'galv', 0, floor + 0.31, 0, Math.PI / 2);
    k.box(0.04, 0.04, 0.4, 'galv', 0, floor + 0.64, 0); k.box(0.4, 0.04, 0.04, 'galv', 0, floor + 0.64, 0);
    k.cyl(0.06, 0.06, -floor - 0.6 + 0.02, 'iron', 0, (floor + 0.62) / 2 + 0.01, 0);
    k.pipeX(0.06, 0.24, 'iron', 0.1, 0, 0); k.sphere(0.075, 'iron', 0, 0, 0);
  },
  inlet(k, floor) { valve(k, floor, 'red'); },
  outlet(k, floor) { valve(k, floor, 'blue'); },
  // Cast-iron pump barrel on a cradle, with a motor block and a belt flywheel.
  pump(k, floor) {
    k.cyl(0.21, 0.21, 0.5, 'iron', 0, 0, 0, 0, 0, Math.PI / 2, 12);
    k.flangeX(0.25, 'ironDark', -0.25); k.flangeX(0.25, 'ironDark', 0.25);
    k.cyl(0.08, 0.08, 0.16, 'iron', -0.3, -0.05, 0, 0, 0, Math.PI / 2);
    k.cyl(0.08, 0.08, 0.16, 'iron', 0.3, 0.05, 0, 0, 0, Math.PI / 2);
    k.box(0.36, 0.26, 0.24, 'red', 0, 0.06, -0.3);
    for (let i = 0; i < 4; i++) k.box(0.025, 0.2, 0.25, 'ironDark', -0.13 + i * 0.087, 0.06, -0.3);
    const fly = new THREE.Group(); fly.name = 'spin'; fly.position.set(0, 0.06, 0.24); k.group.add(fly);
    const fk = new Kit(fly, false);
    fk.ring(0.17, 0.03, 'ironDark', 0, 0, 0);
    for (let i = 0; i < 3; i++) fk.box(0.32, 0.03, 0.02, 'ironDark', 0, 0, 0, 0, 0, i * Math.PI / 3);
    k.box(0.08, 0.08, 0.1, 'brass', 0, 0.25, 0);
    for (const x of [-0.17, 0.17]) { k.box(0.06, -floor - 0.16, 0.34, 'ironDark', x, (floor - 0.16) / 2, 0); k.box(0.14, 0.04, 0.4, 'stone', x, floor + 0.02, 0); }
  },
  // Spring relief valve on a tee: brass dome, spring stack, lever, side bypass.
  relief(k, floor) {
    k.pipeX(0.075, 0.42, 'iron'); k.flangeX(0.1, 'iron', -0.19); k.flangeX(0.1, 'iron', 0.19);
    k.cyl(0.09, 0.11, 0.14, 'iron', 0, 0.1, 0);
    for (let i = 0; i < 4; i++) k.ring(0.06, 0.012, 'galv', 0, 0.2 + i * 0.035, 0, Math.PI / 2);
    k.sphere(0.08, 'brass', 0, 0.34, 0, 0.8);
    k.box(0.22, 0.02, 0.03, 'red', 0.08, 0.38, 0, 0, 0, -0.25);
    k.cyl(0.055, 0.055, 0.2, 'iron', 0, -0.08, 0.1, Math.PI / 2.6);
    k.saddle(0.16, 0, floor, -0.08);
  },
  // The village main: a flanged elbow down into the ground with a marker post.
  trunk(k, floor) {
    k.pipeX(0.08, 0.3, 'iron', -0.06); k.flangeX(0.11, 'iron', -0.2);
    k.sphere(0.09, 'iron', 0.1, 0, 0);
    k.cyl(0.08, 0.08, -floor + 0.02, 'iron', 0.1, floor / 2, 0);
    k.cyl(0.16, 0.18, 0.08, 'stone', 0.1, floor + 0.04, 0);
    k.post(0.32, 0.16, floor, 0.34, 'timber', 0.06);
    k.box(0.2, 0.12, 0.02, 'blue', 0.32, 0.3, 0.2);
  },
  // Bypass drain: an elbow down to an iron grate set in stone.
  bypass(k, floor) {
    k.cyl(0.055, 0.055, -floor - 0.06, 'iron', 0, (floor + 0.06) / 2 + 0.06, 0);
    k.sphere(0.065, 'iron', 0, 0.08, 0);
    k.box(0.44, 0.06, 0.44, 'stone', 0, floor + 0.03, 0);
    for (let i = -2; i <= 2; i++) k.box(0.025, 0.02, 0.32, 'ironDark', i * 0.065, floor + 0.07, 0);
  },
  // Vibration-isolating skid: steel frame on four rubber pucks.
  mount(k, floor) {
    for (const z of [-0.18, 0.18]) k.box(0.62, 0.07, 0.07, 'galv', 0, floor + 0.1, z);
    for (const x of [-0.26, 0.26]) k.box(0.07, 0.07, 0.42, 'galv', x, floor + 0.1, 0);
    for (const x of [-0.24, 0.24]) for (const z of [-0.18, 0.18]) k.cyl(0.055, 0.06, 0.06, 'rubber', x, floor + 0.03, z, 0, 0, 0, 8);
    for (const x of [-0.17, 0.17]) k.cyl(0.05, 0.05, 0.05, 'rubber', x, floor + 0.16, 0, 0, 0, 0, 8);
  },
  // Acoustic housing: louvred timber walls and roof, service hatch swung open.
  housing(k, floor) {
    const cy = -0.3, w = 0.92, h = 0.8, d = 0.78;
    k.box(w, 0.05, d + 0.08, 'tin', 0, cy + h / 2 + 0.03, 0, 0, 0, 0);
    k.box(w, h, 0.05, 'timber', 0, cy, -d / 2);
    for (const s of [-1, 1]) {
      k.box(0.05, h, d, 'timber', s * w / 2, cy, 0);
      for (let i = 0; i < 4; i++) k.box(0.06, 0.03, d * 0.7, 'timberDark', s * (w / 2 + 0.02), cy + 0.22 - i * 0.12, 0, 0.5, 0, 0);
    }
    const hatch = new THREE.Group(); hatch.position.set(-w / 2, cy, d / 2); hatch.rotation.y = -1.9; k.group.add(hatch);
    const hk = new Kit(hatch, false);
    hk.box(w * 0.92, h * 0.86, 0.04, 'timber', w * 0.46, 0, 0.02);
    hk.box(0.05, 0.12, 0.05, 'brass', w * 0.86, 0, 0.06);
    for (const s of [-1, 1]) for (const z of [-d / 2, d / 2]) k.post(s * w / 2, z, floor, cy - h / 2, 'timberDark', 0.06);
  },
  // Rain catchment: a tin lean-to roof on two posts, falling towards the gutter.
  roof(k, floor) {
    const roof = new THREE.Group(); roof.rotation.z = -0.24; k.group.add(roof);
    const rk = new Kit(roof, false);
    rk.box(1.0, 0.035, 0.86, 'tin');
    for (let i = 0; i < 8; i++) rk.box(1.0, 0.03, 0.03, 'tin', 0, 0.03, -0.39 + i * 0.112);
    for (const z of [-0.36, 0.36]) rk.box(1.04, 0.06, 0.05, 'timberDark', 0, -0.04, z);
    for (const [x, z] of [[-0.4, -0.34], [-0.4, 0.34], [0.38, -0.34], [0.38, 0.34]] as const) k.post(x, z, floor, -0.04 - x * 0.245, 'timberDark', 0.07);
  },
  gutter(k, floor) {
    const g = new THREE.Group(); g.rotation.z = -0.1; k.group.add(g);
    const gk = new Kit(g, false);
    gk.halfpipe(0.62);
    gk.box(0.66, 0.02, 0.03, 'galv', 0, 0.06, -0.05);
    k.post(0.22, -0.12, floor, -0.06, 'timberDark', 0.05);
  },
  // Leaf screen: a timber hopper with a mesh lid catching debris.
  leaf_screen(k, floor) {
    k.cyl(0.2, 0.12, 0.24, 'timber', 0, 0, 0, 0, 0, 0, 4).rotation.y = Math.PI / 4;
    k.box(0.3, 0.02, 0.3, 'mesh', 0, 0.13, 0);
    k.box(0.32, 0.02, 0.32, 'galv', 0, 0.12, 0);
    for (let i = 0; i < 3; i++) k.box(0.06, 0.02, 0.05, 0 === i ? 'timberDark' : 'sand', -0.08 + i * 0.08, 0.15, 0.02 * i);
    k.post(0, 0, floor, -0.12, 'timberDark', 0.06);
  },
  // First-flush diverter: clear standpipe with a floating ball, drain cap at the foot.
  first_flush(k, floor) {
    k.sphere(0.06, 'galv', 0, 0.12, 0);
    k.cyl(0.055, 0.055, 0.12 - floor - 0.12, 'glass', 0, (0.12 + floor + 0.12) / 2, 0);
    k.cyl(0.05, 0.05, 0.3, 'water', 0, floor + 0.3, 0);
    k.sphere(0.045, 'red', 0, floor + 0.48, 0);
    k.cyl(0.075, 0.075, 0.08, 'brass', 0, floor + 0.1, 0);
    k.box(0.06, 0.06, 0.06, 'stone', 0, floor + 0.03, 0);
    k.pipeX(0.04, 0.16, 'galv', 0.1, -0.05, 0);
  },
  // Covered rainwater tank: staved timber with iron hoops and a conical lid.
  cistern(k, floor) {
    const h = 1.12, cy = floor + h / 2 + 0.04;
    k.cyl(0.42, 0.42, 0.06, 'stone', 0, floor + 0.03, 0, 0, 0, 0, 12);
    k.cyl(0.36, 0.38, h, 'timber', 0, cy, 0, 0, 0, 0, 14);
    for (const t of [0.12, 0.5, 0.88]) k.ring(0.375, 0.022, 'hoop', 0, floor + 0.04 + h * t, 0, Math.PI / 2);
    const lid = k.cone(0.44, 0.24, floor + h + 0.16);
    lid.rotation.y = Math.PI / 14;
    k.cyl(0.05, 0.05, 0.1, 'brass', 0.26, floor + 0.2, 0.2);
  },
  // Sand-and-gravel filter canister with banded layers.
  filter(k, floor) {
    k.cyl(0.15, 0.15, 0.08, 'galv', 0, 0.16, 0);
    k.cyl(0.14, 0.14, 0.1, 'glass', 0, 0.07, 0);
    k.cyl(0.13, 0.13, 0.08, 'sand', 0, 0.06, 0);
    k.cyl(0.14, 0.14, 0.16, 'galv', 0, -0.08, 0);
    k.cyl(0.04, 0.04, 0.12, 'galv', 0, -0.2, 0.08, Math.PI / 2.8);
    k.post(0, -0.1, floor, -0.16, 'ironDark', 0.05);
  },
  // Delivery tap: brass spout over a stone basin, blue wheel.
  delivery_valve(k, floor) {
    k.pipeZ(0.045, 0.3, 'galv', 0, 0, -0.1);
    k.box(0.12, 0.12, 0.12, 'brass', 0, 0, 0.05);
    k.cyl(0.035, 0.03, 0.18, 'brass', 0.05, -0.08, 0.1, 0, 0, 0.9);
    const handle = new THREE.Group(); handle.name = 'handle'; handle.position.set(0, 0.12, 0.05); k.group.add(handle);
    const hk = new Kit(handle, false);
    hk.ring(0.08, 0.016, 'blue', 0, 0, 0, Math.PI / 2); hk.box(0.16, 0.015, 0.02, 'blue');
    k.box(0.36, 0.12, 0.28, 'stone', 0.08, floor + 0.06, 0.1);
    k.box(0.28, 0.02, 0.2, 'water', 0.08, floor + 0.12, 0.1);
    k.post(0, -0.1, floor + 0.12, -0.06, 'stone', 0.08);
  },
  village_trunk(k, floor) {
    k.pipeX(0.06, 0.24, 'galv', -0.06);
    k.sphere(0.07, 'galv', 0.06, 0, 0);
    k.cyl(0.06, 0.06, -floor + 0.02, 'galv', 0.06, floor / 2, 0);
    k.cyl(0.14, 0.16, 0.06, 'stone', 0.06, floor + 0.03, 0);
    k.post(0.24, 0.12, floor, 0.24, 'timber', 0.05);
    k.box(0.16, 0.1, 0.02, 'blue', 0.24, 0.2, 0.15);
  },
  // Overflow line on saddles, sloping to the soakaway.
  overflow_pipe(k, floor) {
    k.cyl(0.055, 0.055, 0.66, 'galv', 0, 0, 0, 0, 0, Math.PI / 2 + 0.06);
    k.flangeX(0.08, 'galv', 0.32, 0.02); k.flangeX(0.08, 'galv', -0.32, -0.02);
    k.saddle(-0.18, 0, floor, -0.06); k.saddle(0.18, 0, floor, -0.04);
  },
  // Soakaway: a ring of stones around a gravel pit.
  soakaway(k, floor) {
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + 0.3, s = 0.075 + ((i * 37) % 5) * 0.01;
      k.rock(s, Math.cos(a) * 0.31, floor + s * 0.5, Math.sin(a) * 0.31, a);
    }
    k.cyl(0.27, 0.28, 0.05, 'gravel', 0, floor + 0.02, 0, 0, 0, 0, 12);
    for (let i = 0; i < 7; i++) k.sphere(0.035, 'gravel', Math.cos(i * 2.3) * 0.16, floor + 0.05, Math.sin(i * 2.3) * 0.16, 0.6);
  },
};

/** Build the authored model for one village pump slot, or null if none exists. */
export function buildPumpPart(slot: string, options: { worn: boolean; seed?: number }): THREE.Group | null {
  const build = PUMP_PARTS[slot];
  if (!build) return null;
  const group = new THREE.Group();
  const floor = PLATFORM_TOP - socketPosition('village_pump', slot).y;
  build(new Kit(group, options.worn), floor, {});
  if (options.worn) {
    // A storm-knocked machine: a slight lean, so the broken state reads at a glance.
    const s = (options.seed ?? slot.length) * 12.9898;
    group.rotation.x = Math.sin(s) * 0.09;
    group.rotation.z = Math.cos(s * 1.7) * 0.14;
  }
  group.name = `pump-part:${slot}`;
  return group;
}

/** Turn a part's handle to show its setting (index into the allowed settings). */
export function setPumpHandle(part: THREE.Object3D, settingIndex: number): void {
  const handle = part.getObjectByName('handle');
  if (handle) handle.rotation.y = settingIndex * Math.PI / 4;
}

/** Spin flywheels while the pump is working. */
export function animatePumpPart(part: THREE.Object3D, seconds: number, running: boolean): void {
  const spin = part.getObjectByName('spin');
  if (spin && running) spin.rotation.z = -seconds * 9;
}

/** The stone platform that replaces the plain service board at the village pump. */
export function buildPumpPlatform(): THREE.Group {
  const group = new THREE.Group(); group.name = 'pump-platform';
  const k = new Kit(group, false);
  const { width, depth, height, y } = SERVICE_BOARD;
  k.box(width + 0.12, height, depth + 0.12, 'stone', 0, y, 0);
  // Flagstones in an offset running bond.
  for (let row = 0; row < 3; row++) {
    const z = -depth / 2 + depth / 6 + row * depth / 3;
    let x = -width / 2 + (row % 2 ? 0.28 : 0);
    let i = 0;
    while (x < width / 2 - 0.05) {
      const w = Math.min(0.5 + ((row * 7 + i * 3) % 4) * 0.12, width / 2 - x);
      k.box(w - 0.04, 0.03, depth / 3 - 0.04, 'flag', x + w / 2, PLATFORM_TOP + 0.005, z);
      x += w; i++;
    }
  }
  // Kerb stones along the long edges.
  for (const z of [-depth / 2 - 0.02, depth / 2 + 0.02]) for (let i = 0; i < 6; i++) k.box(width / 6 - 0.03, 0.08, 0.1, 'stone', -width / 2 + width / 12 + i * width / 6, PLATFORM_TOP + 0.04, z, 0, 0, 0);
  return group;
}

const beadGeometry = new THREE.SphereGeometry(0.068, 8, 6);
const beadMaterial = new THREE.MeshBasicMaterial({ color: 0xbff4ff });
/** Move flow beads along their pipes; hidden when nothing runs. */
export function animatePipeFlow(group: THREE.Object3D, seconds: number, running: boolean): void {
  group.traverse(o => {
    const flow = o.userData.flow as { a: THREE.Vector3; b: THREE.Vector3; offset: number } | undefined;
    if (!flow) return;
    o.visible = running;
    if (running) o.position.lerpVectors(flow.a, flow.b, (seconds * 0.9 + flow.offset) % 1);
  });
}

/** Straight plumbing between two port points, with collars at each end. */
export function pumpPipe(a: THREE.Vector3, b: THREE.Vector3, water: boolean, material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  const dir = b.clone().sub(a), len = dir.length();
  if (len < 1e-3) return group;
  const r = water ? 0.05 : 0.022;
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), material);
  pipe.position.copy(a).add(b).multiplyScalar(0.5);
  pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  pipe.castShadow = pipe.receiveShadow = true;
  group.add(pipe);
  if (water) {
    // Flow beads run from the outlet end to the inlet end while water moves.
    const count = Math.max(2, Math.round(len / 0.28));
    for (let i = 0; i < count; i++) {
      const bead = new THREE.Mesh(beadGeometry, beadMaterial);
      bead.userData.flow = { a: a.clone(), b: b.clone(), offset: i / count };
      bead.visible = false; bead.renderOrder = 4;
      group.add(bead);
    }
  }
  if (water) for (const p of [a, b]) {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.45, r * 1.45, 0.05, 8), paint('galv'));
    collar.position.copy(p); collar.quaternion.copy(pipe.quaternion); collar.castShadow = true;
    group.add(collar);
  }
  return group;
}

const ghostDim = new THREE.MeshBasicMaterial({ color: 0x9fe6ff, transparent: true, opacity: 0.22, depthWrite: false });
const ghostBright = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.55, depthWrite: false });
/** Blueprint ghost of a part at its empty socket; the held part's ghost glows warm. */
export function ghostPumpPart(slot: string, held: boolean): THREE.Group | null {
  const part = buildPumpPart(slot, { worn: false });
  if (!part) return null;
  part.traverse(o => { if (o instanceof THREE.Mesh) { o.material = held ? ghostBright : ghostDim; o.castShadow = o.receiveShadow = false; o.renderOrder = 5; } });
  part.userData.ghostHeld = held;
  return part;
}
/** Pulse the held ghost so the socket to tap is unmistakable. */
export function pulseGhosts(seconds: number): void { ghostBright.opacity = 0.42 + Math.sin(seconds * 5) * 0.2; }

const portMaterials = new Map<string, THREE.MeshStandardMaterial>();
/** Port knobs: outlets warm, inlets cool, the picked one bright. */
export function portMaterial(direction: 'in' | 'out' | 'bidirectional', active: boolean): THREE.MeshStandardMaterial {
  const key = active ? 'active' : direction;
  let m = portMaterials.get(key);
  if (!m) {
    const colour = active ? 0xffd27a : direction === 'in' ? 0x6fd0ea : 0xf09a3e;
    m = new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: active ? 0.9 : 0.45, roughness: 0.4 });
    portMaterials.set(key, m);
  }
  return m;
}
