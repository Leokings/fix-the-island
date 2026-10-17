import * as THREE from 'three';
import { SERVICE_BOARD } from '../../../content/service-layout';
import { Kit, valve, type PartBuilder } from '../pump-machinery';

// Ridge Cistern: a stone storage tank on the upland, a sand filter, a splitter
// and two valves sharing filtered water between the village and the habitat,
// with an overflow spillway. Presentation only.

const TOP = SERVICE_BOARD.y + SERVICE_BOARD.height / 2;

export const WATERWORKS_PARTS: Readonly<Record<string, PartBuilder>> = {
  // Covered stone cistern with a timber lid and a ladder.
  cistern(k, floor) {
    const h = 1.5, cy = floor + h / 2;
    k.cyl(0.5, 0.56, h, 'stone', 0, cy, 0, 0, 0, 0, 12);
    for (const t of [0.25, 0.6, 0.92]) k.ring(0.54 - t * 0.05, 0.02, 'ironDark', 0, floor + h * t, 0, Math.PI / 2);
    k.cyl(0.56, 0.56, 0.08, 'timberDark', 0, floor + h + 0.04, 0, 0, 0, 0, 12);
    k.cone(0.6, 0.3, floor + h + 0.23).rotation.y = Math.PI / 12;
    for (const s of [-1, 1]) k.box(0.04, h, 0.04, 'timber', -0.56, cy, s * 0.14);
    for (let i = 1; i < 6; i++) k.box(0.04, 0.03, 0.3, 'timber', -0.58, floor + i * h / 6, 0);
    k.cyl(0.05, 0.05, 0.18, 'galv', 0.5, floor + 0.3, 0, 0, 0, Math.PI / 2);
  },
  // Sand filter: a tall canister with banded layers and a sight glass.
  filter(k, floor) {
    k.cyl(0.24, 0.24, 0.1, 'galv', 0, 0.3, 0);
    k.cyl(0.22, 0.22, 0.22, 'glass', 0, 0.14, 0);
    k.cyl(0.2, 0.2, 0.08, 'sand', 0, 0.09, 0);
    k.cyl(0.2, 0.2, 0.06, 'gravel', 0, 0.03, 0);
    k.cyl(0.23, 0.23, -floor - 0.02, 'galv', 0, floor / 2 - 0.01, 0);
    k.box(0.4, 0.06, 0.4, 'stone', 0, floor + 0.03, 0);
  },
  // Splitter: a brass manifold that divides the flow two ways.
  splitter(k, floor) {
    k.box(0.22, 0.18, 0.22, 'brass', 0, 0, 0);
    k.pipeX(0.06, 0.2, 'galv', -0.18, 0, 0);
    k.pipeZ(0.055, 0.2, 'galv', 0.06, 0, 0.18);
    k.pipeZ(0.055, 0.2, 'galv', 0.06, 0, -0.18);
    k.saddle(0, 0, floor, -0.1);
  },
  village_valve(k, floor) { valve(k, floor, 'blue'); },
  habitat_valve(k, floor) { valve(k, floor, 'red'); },
  // Village outlet: a stone trough with a spout.
  village(k, floor) {
    k.box(0.5, 0.2, 0.32, 'stone', 0.12, floor + 0.1, 0);
    k.box(0.42, 0.02, 0.24, 'water', 0.12, floor + 0.19, 0);
    k.cyl(0.035, 0.03, 0.2, 'brass', -0.06, 0.02, 0, 0, 0, 1.2);
    k.post(0.4, 0.14, floor, 0.3, 'timber', 0.05);
    k.box(0.18, 0.12, 0.02, 'blue', 0.4, 0.28, 0.17);
  },
  // Habitat outlet: a mossy pool with reeds for upland wildlife.
  habitat(k, floor) {
    k.cyl(0.32, 0.34, 0.08, 'mud', 0.1, floor + 0.04, 0, 0, 0, 0, 12);
    k.cyl(0.27, 0.27, 0.02, 'water', 0.1, floor + 0.08, 0, 0, 0, 0, 12);
    for (let i = 0; i < 5; i++) { const a = i * 1.3; k.cyl(0.008, 0.012, 0.36, 'reed', 0.1 + Math.cos(a) * 0.3, floor + 0.2, Math.sin(a) * 0.3, 0, 0, 0, 4); }
    k.cyl(0.035, 0.03, 0.14, 'galv', -0.12, 0.02, 0, 0, 0, 1.3);
  },
  // Overflow: a stone spillway lip down to a gravel bed.
  overflow(k, floor) {
    k.box(0.5, 0.08, 0.34, 'stone', 0, floor + 0.04, 0);
    k.box(0.44, 0.03, 0.26, 'gravel', 0, floor + 0.09, 0);
    k.cyl(0.05, 0.05, 0.3, 'galv', 0, -0.12, 0, 0.3, 0, 0);
  },
};

/** Flagged stone pad on the upland plateau. */
export function buildWaterworksPlatform(): THREE.Group {
  const group = new THREE.Group(); group.name = 'waterworks-platform';
  const k = new Kit(group, false);
  const { width, depth, height, y } = SERVICE_BOARD;
  k.box(width + 0.12, height, depth + 0.12, 'stone', 0, y, 0);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) k.box(width / 6 - 0.05, 0.03, depth / 2 - 0.05, (i + j) % 2 ? 'flag' : 'stone', -width / 2 + width / 12 + i * width / 6, TOP + 0.005, -depth / 4 + j * depth / 2);
  return group;
}
