import * as THREE from 'three';
import { Kit, type PartBuilder } from '../pump-machinery';

// Splitbank Bridge: stone shoes on each bank, two planked deck halves meeting
// mid-span, a truss beam braced from the shoes, and rope handrails that sag when
// left loose. Built along x across the creek. Presentation only.

/** Planked deck half, 4.8 m long and 2.4 m wide. */
function deck(k: Kit): void {
  for (const z of [-0.9, 0, 0.9]) k.box(4.8, 0.14, 0.16, 'timberDark', 0, -0.1, z);
  for (let i = 0; i < 16; i++) k.box(0.27, 0.06, 2.4, i % 4 === 1 ? 'timberDark' : 'timber', -2.25 + i * 0.3, 0, 0, 0, 0, ((i * 7) % 5 - 2) * 0.006);
  for (let i = 0; i < 16; i += 3) for (const z of [-0.9, 0.9]) k.box(0.04, 0.02, 0.04, 'ironDark', -2.25 + i * 0.3, 0.035, z);
}
/** A diagonal timber brace with iron shoes, rising toward mid-span. */
function brace(k: Kit, rise: number): void {
  const g = new THREE.Group(); g.rotation.z = rise; k.group.add(g);
  const b = new Kit(g, k.worn);
  b.box(2.5, 0.16, 0.16, 'timber');
  for (const x of [-1.2, 1.2]) b.box(0.16, 0.2, 0.2, 'ironDark', x, 0, 0);
  for (const x of [-0.4, 0.4]) b.box(0.03, 0.18, 0.18, 'ironDark', x, 0, 0);
}

export const BRIDGE_PARTS: Readonly<Record<string, PartBuilder>> = {
  shoe_left(k) { shoe(k); },
  shoe_right(k) { shoe(k); },
  deck_left(k) { deck(k); },
  deck_right(k) { deck(k); },
  // Truss beam: the top chord the braces push against, with iron gusset plates.
  beam(k) {
    k.box(4.2, 0.2, 0.2, 'timber', 0, 0, 0);
    for (const x of [-2.0, 0, 2.0]) k.box(0.3, 0.3, 0.24, 'ironDark', x, 0, 0);
    // King posts down to the deck edge.
    for (const x of [-1.0, 1.0]) k.box(0.1, 1.2, 0.1, 'timberDark', x, -0.6, 0.25);
  },
  brace_left(k) { brace(k, 0.5); },
  brace_right(k) { brace(k, -0.5); },
  // Handrails: posts both sides with a rope that sags when loose.
  rail(k) {
    for (const z of [-1.15, 1.15]) {
      // On the broken bridge only the bank posts stand; the rope hangs slack across the gap.
      for (let x = -4.4; x <= 4.41; x += 1.1) if (!k.worn || Math.abs(x) > 3.2) k.box(0.08, 0.9, 0.08, 'timberDark', x, -0.45, z);
      const slide = new THREE.Group(); slide.name = 'slide'; slide.userData = { base: 0, step: -0.16 }; k.group.add(slide);
      const sk = new Kit(slide, k.worn);
      for (let x = -4.4; x < 4.4; x += 1.1) {
        // Each rope span dips slightly between posts.
        const sag = k.worn ? -0.55 * Math.cos((x + 0.55) / 4.4 * Math.PI / 2) : -0.05;
        sk.cyl(0.022, 0.022, 1.12, 'rope', x + 0.55, sag, z, 0, 0, Math.PI / 2);
      }
    }
  },
};

function shoe(k: Kit): void {
  k.box(0.9, 0.55, 2.7, 'stone', 0, -0.32, 0);
  for (const z of [-1.0, -0.33, 0.33, 1.0]) k.box(0.92, 0.04, 0.6, 'flag', 0, -0.03, z);
  k.box(0.7, 0.12, 2.5, 'timberDark', 0, 0.05, 0);
}
