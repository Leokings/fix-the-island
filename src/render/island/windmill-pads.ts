import * as THREE from 'three';
import type { WorldSnapshot } from '../../domain/world';
import { GULL_LEDGE, SITE_ANCHORS, WINDMILL_PADS, groundHeight } from '../../content/stylized-island';

// Presentation only. The Headland Windmill's two mounting places and the gull
// ledge the council asks about: the service pad sits back from the cliff by the
// service track; the bluff pad sits on the seaward edge directly above a ledge
// where gulls nest, three metres down. The pad the current build uses glows.

const anchor = SITE_ANCHORS.coast_windmill!;
const LEDGE = GULL_LEDGE;
export { WINDMILL_PADS };

const flat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, ...extra });
const slab = flat(0xb9b2a4), paint = flat(0xf2ead6), post = flat(0x7a5232), board = flat(0xe8d9b4);
const twig = flat(0x8a6a44), egg = flat(0xe9e2cf), white = flat(0xf4f1ea), grey = flat(0x9aa3a8), beak = flat(0xe0903a);

function pad(label: 'service' | 'bluff'): { group: THREE.Group; glow: THREE.Mesh } {
  const group = new THREE.Group(); group.name = `windmill-${label}-pad`;
  const stone = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 1.7), slab); stone.position.y = 0.06; stone.receiveShadow = stone.castShadow = true; group.add(stone);
  // Painted corner marks, like a surveyed mount.
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.08), paint); mark.position.set(sx * 0.62, 0.13, sz * 0.78); group.add(mark);
    const mark2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.34), paint); mark2.position.set(sx * 0.78, 0.13, sz * 0.62); group.add(mark2);
  }
  // A small signboard: a bar of colour reads at play distance (green = service, rust = bluff).
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.9, 6), post); pole.position.set(0.95, 0.45, -0.95); pole.castShadow = true; group.add(pole);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.32, 0.05), board); sign.position.set(0.95, 0.86, -0.95); sign.castShadow = true; group.add(sign);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.055), flat(label === 'service' ? 0x4f8a4c : 0xb4532f)); stripe.position.set(0.95, 0.86, -0.95); group.add(stripe);
  const glow = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.18, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0, depthWrite: false }));
  glow.position.y = 0.14; group.add(glow);
  return { group, glow };
}

function nest(seed: number): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 5, 10).rotateX(Math.PI / 2), twig); ring.position.y = 0.06; ring.castShadow = true; g.add(ring);
  for (let i = 0; i < 2 + (seed % 2); i++) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 4), egg); e.scale.set(1, 0.8, 1.25); e.position.set(Math.sin(i * 2.2 + seed) * 0.07, 0.07, Math.cos(i * 2.2 + seed) * 0.07); g.add(e); }
  return g;
}

function gull(): THREE.Group {
  const g = new THREE.Group(); g.name = 'gull';
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 5), white); body.scale.set(0.8, 0.75, 1.5); body.position.y = 0.22; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), white); head.position.set(0, 0.34, 0.2); g.add(head);
  const bill = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 4), beak); bill.rotation.x = Math.PI / 2; bill.position.set(0, 0.33, 0.33); g.add(bill);
  for (const s of [-1, 1]) { const wing = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.36), grey); wing.position.set(s * 0.12, 0.25, -0.03); wing.rotation.z = s * 0.25; g.add(wing); }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.14), grey); tail.position.set(0, 0.22, -0.28); g.add(tail);
  return g;
}

export class WindmillPads {
  readonly group = new THREE.Group();
  private readonly glows: Record<'service_pad' | 'bluff_pad', THREE.Mesh>;
  private readonly gulls: THREE.Group[] = [];
  private time = 0;

  constructor() {
    this.group.name = 'windmill-pads';
    const service = pad('service'), bluff = pad('bluff');
    for (const [id, p] of [['service_pad', service], ['bluff_pad', bluff]] as const) {
      const c = WINDMILL_PADS[id];
      p.group.position.set(c.x, groundHeight(c.x, c.z), c.z);
      p.group.rotation.y = Math.atan2(anchor.x - c.x, anchor.z - c.z);
      this.group.add(p.group);
    }
    this.glows = { service_pad: service.glow, bluff_pad: bluff.glow };
    // The gull ledge: nests and a few gulls on the lower terrace under the bluff pad.
    const out = Math.atan2(LEDGE.x - anchor.x, LEDGE.z - anchor.z);
    [[-1.1, 0.2], [0, -0.3], [1.0, 0.25], [-0.4, 0.9]].forEach(([side, depth], i) => {
      const x = LEDGE.x + Math.cos(out) * side! + Math.sin(out) * depth!, z = LEDGE.z - Math.sin(out) * side! + Math.cos(out) * depth!;
      const n = nest(i); n.position.set(x, groundHeight(x, z), z); this.group.add(n);
      if (i < 3) { const bird = gull(); bird.position.set(x + 0.05, groundHeight(x, z) + 0.05, z); bird.rotation.y = out + Math.PI + (i - 1) * 0.6; this.group.add(bird); this.gulls.push(bird); }
    });
  }

  update(snapshot: WorldSnapshot, dt: number): void {
    this.time += dt;
    const site = snapshot.sites.find(s => s.id === 'coast_windmill');
    const mount = (site?.approvedArtifact ?? site?.draft?.artifact)?.configuration.mountZoneId;
    const building = snapshot.inspectionId === 'coast_windmill';
    for (const id of ['service_pad', 'bluff_pad'] as const) {
      const material = this.glows[id].material as THREE.MeshBasicMaterial;
      // The chosen pad glows while building; afterwards a faint mark stays.
      material.opacity = mount === id ? (building ? 0.55 + Math.sin(this.time * 3) * 0.2 : 0.18) : 0;
      material.color.setHex(id === 'bluff_pad' && building ? 0xff8a5a : 0xffd36a);
    }
    // Gulls bob and turn their heads now and then.
    this.gulls.forEach((g, i) => { g.position.y += Math.sin(this.time * 1.7 + i) * 0.0008; g.children[1]!.rotation.y = Math.sin(this.time * 0.7 + i * 2) * 0.5; });
  }
}
