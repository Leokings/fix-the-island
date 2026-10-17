import * as THREE from 'three';
import { SERVICE_BOARD } from '../../../content/service-layout';
import { Kit, type PartBuilder } from '../pump-machinery';

// Fern Path Light and Lookout Beacon share a small power kit: a battery with a
// solar panel, a fuse, a regulator and cable. The light is a path lantern under a
// downward shade; the beacon aims a reflector and a lens. Lamps glow only while
// the circuit runs. Presentation only.

const TOP = SERVICE_BOARD.y + SERVICE_BOARD.height / 2;
const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xffe7a8 });

function glowBulb(k: Kit, r: number, x: number, y: number, z: number): void {
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), glowMaterial);
  bulb.name = 'glow'; bulb.position.set(x, y, z); bulb.visible = false;
  k.group.add(bulb);
  k.sphere(r * 0.8, 'lamp', x, y, z);
}

/** Battery crate with brass terminals and a small solar panel on a stand. */
function battery(k: Kit, floor: number): void {
  k.box(0.42, 0.3, 0.3, 'timber', 0, floor + 0.15, 0);
  for (const x of [-0.12, 0.12]) k.cyl(0.03, 0.03, 0.06, 'brass', x, floor + 0.33, 0);
  k.box(0.36, 0.02, 0.24, 'ironDark', 0, floor + 0.31, 0);
  const panel = new THREE.Group(); panel.position.set(0, floor + 0.62, -0.05); panel.rotation.x = -0.6; k.group.add(panel);
  const pk = new Kit(panel, k.worn);
  pk.box(0.5, 0.03, 0.34, 'galv');
  for (let i = 0; i < 3; i++) pk.box(0.14, 0.035, 0.3, 'blue', -0.16 + i * 0.16, 0.005, 0);
  k.post(0, -0.15, floor, floor + 0.55, 'ironDark', 0.04);
}
/** A weatherproof box on a short post: fuse (glass window) or regulator (dial). */
function boxOnPost(k: Kit, floor: number, kind: 'fuse' | 'regulator'): void {
  k.post(0, -0.04, floor, -0.12, 'timberDark', 0.07);
  k.box(0.3, 0.28, 0.18, kind === 'fuse' ? 'iron' : 'galv', 0, 0, 0);
  k.box(0.32, 0.04, 0.2, 'ironDark', 0, 0.16, 0);
  if (kind === 'fuse') { k.box(0.16, 0.1, 0.02, 'glass', 0, 0.02, 0.1); k.cyl(0.02, 0.02, 0.12, 'brass', 0, 0.02, 0.1, 0, 0, Math.PI / 2); }
  else { k.cyl(0.06, 0.06, 0.02, 'canvas', 0, 0.03, 0.1, Math.PI / 2); k.box(0.005, 0.05, 0.01, 'red', 0.01, 0.04, 0.115, 0, 0, -0.6); k.box(0.04, 0.04, 0.02, 'lamp', 0.09, -0.08, 0.1); }
}

export const PATHLIGHT_PARTS: Readonly<Record<string, PartBuilder>> = {
  source(k, floor) { battery(k, floor); },
  fuse(k, floor) { boxOnPost(k, floor, 'fuse'); },
  regulator(k, floor) { boxOnPost(k, floor, 'regulator'); },
  // Path lantern on a tall post with a glass housing.
  lamp(k, floor) {
    k.post(0, 0, floor, -0.25, 'timberDark', 0.1);
    k.box(0.3, 0.04, 0.3, 'ironDark', 0, -0.22, 0);
    for (const [x, z] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]] as const) k.box(0.025, 0.36, 0.025, 'ironDark', x, -0.03, z);
    k.box(0.24, 0.34, 0.24, 'glass', 0, -0.03, 0);
    glowBulb(k, 0.07, 0, -0.03, 0);
    k.cone(0.22, 0.14, 0.2);
  },
  // Cable return: a low junction box beside the path.
  return(k, floor) {
    k.box(0.26, 0.18, 0.18, 'iron', 0, floor + 0.09, 0);
    k.box(0.28, 0.03, 0.2, 'ironDark', 0, floor + 0.19, 0);
    k.cyl(0.02, 0.02, -floor, 'cable', 0, floor / 2, 0.06);
  },
  // Downward shade over the lantern: turned wrongly, it throws light into the trees.
  shield(k) {
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.2, 14, 1, true), new THREE.MeshStandardMaterial({ color: k.worn ? 0x6d5a3e : 0x2f6b4f, flatShading: true, roughness: 0.7, side: THREE.DoubleSide }));
    shade.position.y = -0.05; shade.castShadow = true; k.group.add(shade);
    k.ring(0.34, 0.015, 'brass', 0, -0.15, 0, Math.PI / 2);
    k.cyl(0.02, 0.02, 0.12, 'ironDark', 0, 0.1, 0);
  },
};

export const BEACON_PARTS: Readonly<Record<string, PartBuilder>> = {
  source(k, floor) { battery(k, floor); },
  fuse(k, floor) { boxOnPost(k, floor, 'fuse'); },
  regulator(k, floor) { boxOnPost(k, floor, 'regulator'); },
  // Stone plinth that seats the reflector's mast.
  plinth(k, floor) {
    k.box(0.5, 0.12, 0.5, 'stone', 0, floor + 0.06, 0);
    k.box(0.38, -floor + 0.02, 0.38, 'flag', 0, floor / 2 + 0.07, 0);
    k.box(0.44, 0.06, 0.44, 'stone', 0, 0.08, 0);
  },
  // Reflector: a parabolic dish on a yoke; its setting turns the beam's sector.
  reflector(k) {
    const plinthTop = 0.4 + 0.11 - 1.55;
    k.cyl(0.04, 0.05, -plinthTop - 0.1, 'ironDark', 0, plinthTop / 2 - 0.05, 0);
    const aim = new THREE.Group(); aim.name = 'handle'; k.group.add(aim);
    const ak = new Kit(aim, k.worn);
    ak.box(0.06, 0.3, 0.06, 'ironDark', -0.26, 0, 0); ak.box(0.06, 0.3, 0.06, 'ironDark', 0.26, 0, 0);
    ak.box(0.58, 0.05, 0.06, 'ironDark', 0, -0.15, 0);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 3), new THREE.MeshStandardMaterial({ color: k.worn ? 0x8d7a5c : 0xe4e7e2, metalness: k.worn ? 0 : 0.6, roughness: k.worn ? 0.9 : 0.25, side: THREE.DoubleSide, flatShading: true }));
    dish.rotation.x = -Math.PI / 2; dish.position.z = 0.2; dish.castShadow = true; aim.add(dish);
    ak.cyl(0.03, 0.03, 0.2, 'brass', 0, 0, 0.12, Math.PI / 2);
  },
  // Lens: a brass lantern with a fresnel face, glowing when powered; "closed" drops its shutter.
  lens(k, floor) {
    k.post(0, 0, floor, -0.22, 'ironDark', 0.07);
    k.cyl(0.2, 0.22, 0.4, 'brass', 0, 0, 0, 0, 0, 0, 12);
    k.cyl(0.17, 0.17, 0.05, 'glass', 0, 0, 0.21, Math.PI / 2, 0, 0, 14);
    for (let i = 1; i <= 3; i++) k.ring(0.04 * i, 0.008, 'galv', 0, 0, 0.24, 0, 0, 0);
    glowBulb(k, 0.09, 0, 0, 0.14);
    const shutter = new THREE.Group(); shutter.name = 'slide'; shutter.userData = { base: 0.42, step: -0.42 }; k.group.add(shutter);
    new Kit(shutter, k.worn).box(0.38, 0.36, 0.03, 'ironDark', 0, 0, 0.25);
  },
  // Visor over the lens keeping the beam off the nests below.
  shield(k) {
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 12, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: k.worn ? 0x6d5a3e : 0x37505a, flatShading: true, roughness: 0.6, side: THREE.DoubleSide }));
    hood.rotation.set(Math.PI / 2, 0, 0); hood.position.set(0, -0.32, 0.1); hood.castShadow = true; k.group.add(hood);
    k.box(0.06, 0.2, 0.06, 'ironDark', 0, -0.05, -0.1);
  },
};

/** A gravel-and-timber pad by the path (light) or a stone lookout pad (beacon). */
export function buildElectricPlatform(kind: 'path' | 'ridge'): THREE.Group {
  const group = new THREE.Group(); group.name = `${kind}-platform`;
  const k = new Kit(group, false);
  const { width, depth, height, y } = SERVICE_BOARD;
  if (kind === 'path') {
    k.box(width + 0.1, height, depth + 0.1, 'mud', 0, y, 0);
    for (const z of [-depth / 2, depth / 2]) k.box(width + 0.16, 0.14, 0.1, 'timberDark', 0, y + 0.04, z);
    for (let i = 0; i < 9; i++) k.sphere(0.05, 'stone', -width / 2 + 0.2 + i * 0.44, TOP + 0.01, (i % 2 ? 0.3 : -0.35), 0.5);
  } else {
    k.box(width + 0.12, height, depth + 0.12, 'stone', 0, y, 0);
    for (let i = 0; i < 5; i++) k.box(width / 5 - 0.04, 0.03, depth - 0.06, i % 2 ? 'flag' : 'stone', -width / 2 + width / 10 + i * width / 5, TOP + 0.005, 0);
  }
  return group;
}
