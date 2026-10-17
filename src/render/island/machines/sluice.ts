import * as THREE from 'three';
import { SERVICE_BOARD } from '../../../content/service-layout';
import { Kit, type PartBuilder } from '../pump-machinery';

// Reedbed Sluice: a timber flume on the shore boardwalk splits the stream three
// ways — to the creek, to the fish nursery and onto the bank — with sliding
// boards to set each share and a debris rack. Presentation only.

const TOP = SERVICE_BOARD.y + SERVICE_BOARD.height / 2;

/** An open timber trough along x with water in it. */
function flume(k: Kit, length: number, x = 0, y = 0, z = 0, ry = 0): void {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; k.group.add(g);
  const f = new Kit(g, k.worn);
  f.box(length, 0.04, 0.3, 'timberDark', 0, -0.1, 0);
  for (const s of [-1, 1]) f.box(length, 0.2, 0.04, 'timber', 0, 0, s * 0.15);
  f.box(length - 0.04, 0.02, 0.26, 'water', 0, -0.04, 0);
}
/** A board that slides in a timber frame; each setting lifts it a notch. */
function slidingBoard(k: Kit, floor: number, width: number, notch: number): void {
  for (const s of [-1, 1]) k.box(0.06, 0.62, 0.08, 'timberDark', 0, 0.18, s * (width / 2 + 0.03));
  k.box(0.06, 0.06, width + 0.14, 'timberDark', 0, 0.5, 0);
  const slide = new THREE.Group(); slide.name = 'slide'; slide.userData = { base: 0, step: notch }; k.group.add(slide);
  const sk = new Kit(slide, k.worn);
  sk.box(0.05, 0.3, width, 'timber', 0, 0.02, 0);
  sk.box(0.07, 0.04, width * 0.6, 'ironDark', 0.02, 0.18, 0);
  k.post(0, 0, floor, -0.12, 'timberDark', 0.08);
}

export const SLUICE_PARTS: Readonly<Record<string, PartBuilder>> = {
  // Intake: a stone headbox catching the stream, three flumes leaving it.
  source(k, floor) {
    k.box(0.6, 0.42, 0.6, 'stone', 0, floor + 0.21, 0);
    k.box(0.5, 0.02, 0.5, 'water', 0, floor + 0.41, 0);
    flume(k, 0.4, 0.42, 0.02, 0);
    flume(k, 0.36, 0.2, 0.02, -0.38, Math.PI / 2.6);
    flume(k, 0.32, 0.18, 0.02, 0.38, -Math.PI / 2.6);
    k.box(0.12, 0.12, 0.12, 'ironDark', 0, floor + 0.48, 0.3);
  },
  bank_baffle(k, floor) { flume(k, 0.5, 0, -0.06, 0, Math.PI / 2); slidingBoard(k, floor, 0.32, 0.16); },
  creek_baffle(k, floor) { flume(k, 0.6, 0, -0.06, 0); slidingBoard(k, floor, 0.32, 0.16); },
  // Nursery gate: a screw-lifted gate with a hand wheel, four flow notches.
  nursery_gate(k, floor) {
    flume(k, 0.6, 0, -0.06, 0);
    slidingBoard(k, floor, 0.32, 0.07);
    k.cyl(0.02, 0.02, 0.5, 'galv', 0, 0.62, 0);
    const handle = new THREE.Group(); handle.name = 'handle'; handle.position.y = 0.88; k.group.add(handle);
    const hk = new Kit(handle, false);
    hk.ring(0.12, 0.02, 'red', 0, 0, 0, Math.PI / 2);
    hk.box(0.22, 0.02, 0.02, 'red');
  },
  // Creek outlet: a stone chute spilling back to the creek.
  creek(k, floor) {
    flume(k, 0.5, -0.1, 0.0, 0);
    k.box(0.4, -floor - 0.08, 0.42, 'stone', 0.2, floor / 2 - 0.04, 0);
    k.box(0.12, 0.02, 0.26, 'water', 0.42, -0.06, 0, 0, 0, -0.9);
    for (let i = 0; i < 4; i++) k.sphere(0.03, 'mesh', 0.48 + i * 0.03, -0.16 - i * 0.05, -0.06 + (i % 2) * 0.1);
  },
  // Nursery pool: a reed-edged pond with a stepping stone and a basking turtle.
  nursery(k, floor) {
    k.cyl(0.42, 0.44, 0.1, 'mud', 0, floor + 0.05, 0, 0, 0, 0, 12);
    k.cyl(0.36, 0.36, 0.02, 'water', 0, floor + 0.1, 0, 0, 0, 0, 12);
    for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.4; k.cyl(0.008, 0.012, 0.42 + (i % 3) * 0.1, 'reed', Math.cos(a) * 0.38, floor + 0.3, Math.sin(a) * 0.38, Math.sin(a) * 0.15, 0, Math.cos(a) * 0.15, 4); }
    const shell = k.sphere(0.07, 'reed', 0.12, floor + 0.13, 0.05, 0.5);
    shell.scale.set(1, 0.5, 1.3);
    k.sphere(0.025, 'mud', 0.12, floor + 0.13, 0.15);
  },
  // Debris rack: a timber grid that is either jammed in the flow or lifted clear and stored.
  rack(k, floor) {
    for (const x of [-0.3, 0.3]) k.post(x, 0, floor, 0.35, 'timberDark', 0.07);
    k.box(0.7, 0.06, 0.06, 'timberDark', 0, 0.35, 0);
    const slide = new THREE.Group(); slide.name = 'slide'; slide.userData = { base: -0.18, step: 0.32 }; k.group.add(slide);
    const sk = new Kit(slide, k.worn);
    for (let i = 0; i < 6; i++) sk.box(0.025, 0.36, 0.03, 'ironDark', -0.22 + i * 0.088, 0, 0);
    sk.box(0.52, 0.04, 0.04, 'ironDark', 0, 0.16, 0);
    for (let i = 0; i < 4; i++) sk.box(0.12 + (i % 2) * 0.06, 0.03, 0.05, 'timber', -0.12 + i * 0.09, -0.12 + (i % 2) * 0.05, 0.04, 0, 0, i * 0.5);
  },
};

/** Shore boardwalk on stilts at the water's edge. */
export function buildSluicePlatform(): THREE.Group {
  const group = new THREE.Group(); group.name = 'sluice-platform';
  const k = new Kit(group, false);
  const { width, depth, height, y } = SERVICE_BOARD;
  for (let i = 0; i < 10; i++) k.box(width / 10 - 0.02, height, depth + 0.1, i % 3 ? 'timber' : 'timberDark', -width / 2 + width / 20 + i * width / 10, y, 0);
  for (const x of [-width / 2 + 0.1, width / 2 - 0.1]) for (const z of [-depth / 2 + 0.1, depth / 2 - 0.1]) k.cyl(0.07, 0.08, 0.9, 'timberDark', x, y - 0.4, z, 0, 0, 0, 6);
  k.box(width + 0.1, 0.05, 0.08, 'timberDark', 0, TOP + 0.02, depth / 2 + 0.02);
  return group;
}
