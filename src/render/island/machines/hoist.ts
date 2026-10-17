import * as THREE from 'three';
import { SERVICE_BOARD } from '../../../content/service-layout';
import { Kit, type PartBuilder } from '../pump-machinery';

// Landing Hoist: a timber balance crane on the shore deck. A fixed mast carries
// the balance boom; the winch, sheave, hood, rope and two counterweights are the
// player's parts. Presentation only.

const TOP = SERVICE_BOARD.y + SERVICE_BOARD.height / 2;
/** Boom pivot height above the deck (matches the boom socket). */
const PIVOT_Y = 2.6;

export const HOIST_PARTS: Readonly<Record<string, PartBuilder>> = {
  // Winch: two timber cheeks, a rope drum and a crank handle that turn together.
  crank(k, floor) {
    for (const z of [-0.2, 0.2]) {
      k.box(0.08, -floor + 0.15, 0.08, 'timberDark', -0.18, floor / 2 + 0.07, z);
      k.box(0.08, -floor + 0.15, 0.08, 'timberDark', 0.18, floor / 2 + 0.07, z);
      k.box(0.46, 0.06, 0.08, 'timberDark', 0, 0.12, z);
    }
    k.box(0.5, 0.06, 0.5, 'timber', 0, floor + 0.03, 0);
    const spin = new THREE.Group(); spin.name = 'spin'; k.group.add(spin);
    const sk = new Kit(spin, k.worn);
    sk.cyl(0.11, 0.11, 0.36, 'timber', 0, 0, 0, Math.PI / 2, 0, 0, 10);
    sk.cyl(0.125, 0.125, 0.24, 'rope', 0, 0, 0, Math.PI / 2, 0, 0, 10);
    for (const z of [-0.19, 0.19]) sk.cyl(0.16, 0.16, 0.03, 'iron', 0, 0, z, Math.PI / 2, 0, 0, 12);
    sk.box(0.05, 0.3, 0.04, 'iron', 0, 0.15, 0.24);
    sk.cyl(0.025, 0.025, 0.16, 'timber', 0, 0.3, 0.32, Math.PI / 2);
  },
  // Sheave: an iron block on a bracket from the mast, with a grooved wheel.
  pulley(k) {
    k.box(0.08, 0.08, 0.42, 'timberDark', 0, 0.3, -0.21);
    k.box(0.06, 0.3, 0.06, 'ironDark', 0, 0.15, 0);
    for (const z of [-0.07, 0.07]) k.box(0.36, 0.36, 0.025, 'iron', 0, 0, z);
    const spin = new THREE.Group(); spin.name = 'spin'; k.group.add(spin);
    const sk = new Kit(spin, k.worn);
    sk.ring(0.15, 0.04, 'ironDark', 0, 0, 0);
    for (let i = 0; i < 3; i++) sk.box(0.28, 0.025, 0.025, 'ironDark', 0, 0, 0, 0, 0, i * Math.PI / 3);
    sk.cyl(0.045, 0.045, 0.18, 'brass', 0, 0, 0, Math.PI / 2);
  },
  // Balance boom: a long beam with iron straps and hooks for the weights and cargo.
  boom(k) {
    k.box(2.9, 0.16, 0.18, 'timber', 0, 0, 0);
    for (const x of [-1.38, -0.3, 0.3, 1.38]) k.box(0.06, 0.2, 0.22, 'ironDark', x, 0, 0);
    k.cyl(0.07, 0.07, 0.3, 'iron', 0, 0, 0, Math.PI / 2);
    for (const x of [-1.0, 0.5, 1.0]) { k.cyl(0.012, 0.012, 0.12, 'ironDark', x, -0.14, 0); k.ring(0.035, 0.01, 'ironDark', x, -0.22, 0); }
  },
  // Lifting rope: hanging from the boom anchor down to a cargo hook, spare coil on the deck.
  rope(k, floor) {
    k.cyl(0.018, 0.018, 1.3, 'rope', 0, 0.75, -0.3, 0.42, 0, 0);
    k.cyl(0.03, 0.03, 0.08, 'ironDark', 0, 0.12, -0.03);
    k.add(new THREE.TorusGeometry(0.07, 0.016, 5, 12, Math.PI * 1.4), 'ironDark', 0, 0.02, 0, 0, 0, Math.PI * 0.8);
    for (let i = 0; i < 3; i++) k.ring(0.16 - i * 0.025, 0.022, 'rope', 0.15, floor + 0.03 + i * 0.03, 0.1, Math.PI / 2);
  },
  // Sheave hood: a curved iron guard over the wheel (the wheel sits 0.65 m to the right).
  guard(k) {
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.22, 12, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: k.worn ? 0x7a5a3c : 0xc9a34a, flatShading: true, roughness: 0.6, side: THREE.DoubleSide }));
    hood.rotation.x = Math.PI / 2; hood.position.set(0.65, 0.04, 0); hood.castShadow = true; k.group.add(hood);
    for (const z of [-0.11, 0.11]) k.ring(0.26, 0.015, 'ironDark', 0.65, 0.04, z, 0, 0, 0);
    k.box(0.5, 0.04, 0.04, 'ironDark', 0.38, 0.28, 0);
  },
  // Counterweight: stacked cast-iron plates on a chain; heavier stock is a taller stack.
  weight_a(k, _floor, facts) { counterweight(k, Number(facts.mass) || 2); },
  weight_b(k, _floor, facts) { counterweight(k, Number(facts.mass) || 2); },
};

function counterweight(k: Kit, mass: number): void {
  const plates = mass >= 3 ? 4 : 3;
  for (let i = 0; i < plates; i++) k.cyl(0.2, 0.2, 0.09, i % 2 ? 'ironDark' : 'iron', 0, -0.2 + i * 0.1, 0, 0, 0, 0, 10);
  k.cyl(0.05, 0.05, 0.08, 'brass', 0, -0.2 + plates * 0.1, 0);
  // Chain up to the boom hook.
  const top = PIVOT_Y - 0.22 - 1.0, from = -0.16 + plates * 0.1;
  for (let y = from; y < top; y += 0.09) k.add(new THREE.TorusGeometry(0.03, 0.009, 4, 8), 'ironDark', 0, y, 0, 0, (Math.round(y * 11) % 2) * Math.PI / 2, Math.PI / 2);
  k.box(0.05, 0.05, 0.05, 'ironDark', 0, top, 0);
}

/** Shore deck with the fixed mast that carries the boom. */
export function buildHoistPlatform(): THREE.Group {
  const group = new THREE.Group(); group.name = 'hoist-platform';
  const k = new Kit(group, false);
  const { width, depth, height, y } = SERVICE_BOARD;
  for (let i = 0; i < 9; i++) k.box(width + 0.1, height, depth / 9 - 0.02, i % 3 ? 'timber' : 'timberDark', 0, y, -depth / 2 + depth / 18 + i * depth / 9);
  for (const x of [-width / 2 + 0.1, 0, width / 2 - 0.1]) k.box(0.1, 0.06, depth + 0.1, 'timberDark', x, TOP + 0.01, 0);
  // A-frame mast at the boom's pivot.
  const z = -0.4;
  for (const dx of [-0.45, 0.45]) {
    const leg = k.box(0.12, PIVOT_Y - TOP, 0.12, 'timberDark', dx * 0.5, (PIVOT_Y + TOP) / 2, z);
    leg.rotation.z = -Math.sign(dx) * 0.17;
  }
  k.box(0.7, 0.08, 0.1, 'timberDark', 0, 1.2, z);
  k.box(0.2, 0.16, 0.2, 'ironDark', 0, PIVOT_Y - 0.08, z);
  return group;
}
