import * as THREE from 'three';

// Presentation only: the crew's timber scaffold and canvas shelter shown while a
// review is pending or the crew is installing. It never implies an approval.

const mat = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, ...extra });
const M = {
  pole: mat(0x8a6a45), plank: mat(0xb08452), rope: mat(0xcdb98c),
  canvas: mat(0xe7dcc2, { side: THREE.DoubleSide }), stripe: mat(0xb9573a, { side: THREE.DoubleSide }),
  crate: mat(0x9b7347), iron: mat(0x56656b, { roughness: 0.6 }), glow: new THREE.MeshBasicMaterial({ color: 0xffd58a }),
};

function piece(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function pole(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r = 0.045, material: THREE.Material = M.pole) {
  const len = a.distanceTo(b), mesh = piece(parent, new THREE.CylinderGeometry(r, r, len, 6), material, 0, 0, 0);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
}
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * A two-bay scaffold behind a site's machine (local site space, machine along x at z≈0),
 * with a plank deck, cross braces, a striped canvas awning, a lantern and a tool crate.
 */
export function buildCrewScaffold(width = 4.6, depth = 1.2, back = -1.15): THREE.Group {
  const g = new THREE.Group(); g.name = 'crew-scaffold';
  const xs = [-width / 2, 0, width / 2], zs = [back - depth / 2, back + depth / 2], top = 3.05, deck = 1.15;
  for (const x of xs) for (const z of zs) pole(g, v(x, 0, z), v(x, top, z));
  for (const z of zs) for (const y of [deck, top - 0.05]) pole(g, v(-width / 2, y, z), v(width / 2, y, z), 0.035);
  for (const x of xs) pole(g, v(x, deck, zs[0]!), v(x, deck, zs[1]!), 0.035);
  // Cross braces on the back face.
  pole(g, v(-width / 2, 0.1, zs[0]!), v(0, deck, zs[0]!), 0.03); pole(g, v(0, 0.1, zs[0]!), v(width / 2, deck, zs[0]!), 0.03);
  pole(g, v(-width / 2, deck, zs[0]!), v(0, top - 0.1, zs[0]!), 0.03); pole(g, v(width / 2, deck, zs[0]!), v(0, top - 0.1, zs[0]!), 0.03);
  // Plank deck with toe boards.
  for (let i = 0; i < 4; i++) piece(g, new THREE.BoxGeometry(width + 0.2, 0.05, depth / 4 - 0.02), M.plank, 0, deck + 0.05, zs[0]! + depth / 8 + i * depth / 4);
  piece(g, new THREE.BoxGeometry(width + 0.2, 0.14, 0.03), M.plank, 0, deck + 0.13, zs[1]! + 0.02);
  // Ladder at one end.
  const lx = -width / 2 - 0.25;
  for (const dz of [-0.2, 0.2]) pole(g, v(lx, 0, back + dz), v(lx + 0.12, deck + 0.7, back + dz), 0.025);
  for (let i = 1; i < 6; i++) { const t = i / 6; pole(g, v(lx + 0.12 * t, (deck + 0.7) * t, back - 0.2), v(lx + 0.12 * t, (deck + 0.7) * t, back + 0.2), 0.018); }
  // Striped canvas awning over the deck only, so the machine below stays in view.
  const awning = new THREE.Group(); awning.position.set(0, top + 0.08, back - 0.1); awning.rotation.x = -0.22; g.add(awning);
  for (let i = 0; i < 8; i++) piece(awning, new THREE.PlaneGeometry(width / 8 + 0.01, depth + 0.5), i % 2 ? M.stripe : M.canvas, -width / 2 + width / 16 + i * width / 8, 0, 0, -Math.PI / 2);
  for (const x of [-width / 2, width / 2]) pole(g, v(x, top, zs[0]!), v(x + Math.sign(x) * 0.5, 0, zs[0]! - 0.9), 0.02, M.rope);
  // Lantern on the front ledger and a tool crate on the deck.
  piece(g, new THREE.CylinderGeometry(0.06, 0.07, 0.16, 6), M.iron, width / 2 - 0.3, top - 0.25, zs[1]!);
  piece(g, new THREE.SphereGeometry(0.055, 8, 6), M.glow, width / 2 - 0.3, top - 0.27, zs[1]!);
  piece(g, new THREE.BoxGeometry(0.5, 0.26, 0.32), M.crate, 0.9, deck + 0.21, back);
  piece(g, new THREE.BoxGeometry(0.46, 0.04, 0.05), M.iron, 0.9, deck + 0.36, back);
  piece(g, new THREE.BoxGeometry(0.7, 0.18, 0.34), M.crate, -1.6, 0.09, back + depth / 2 + 0.45, 0, 0.3);
  return g;
}
