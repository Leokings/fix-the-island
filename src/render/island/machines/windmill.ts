import * as THREE from 'three';
import { Kit, paint, type PartBuilder } from '../pump-machinery';

// Headland Windmill: the gear train inside the mill's cage — the sail shaft, a
// driver and a driven gear (sized by tooth count), a flanged coupling and the
// generator. The mill and its guard cage are the imported windmill model.
// Presentation only; the renderer turns the gears at their real ratio.

/** A spur gear in the xy plane: toothed rim, spokes and hub, radius from its teeth. */
function gear(k: Kit, teeth: number, rimPaint: 'iron' | 'brass'): void {
  const r = 0.32 + teeth / 180, shape = new THREE.Shape();
  for (let i = 0; i < teeth * 4; i++) {
    const a = i / (teeth * 4) * Math.PI * 2, radius = i % 4 === 1 || i % 4 === 2 ? r : r * 0.88;
    const x = Math.cos(a) * radius, y = Math.sin(a) * radius;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, r * 0.74, 0, Math.PI * 2, true); shape.holes.push(hole);
  const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false }), paint(rimPaint, k.worn));
  rim.position.z = -0.05; rim.castShadow = rim.receiveShadow = true; k.group.add(rim);
  const spokes = Math.max(4, Math.round(teeth / 6));
  for (let i = 0; i < spokes; i++) k.box(r * 1.48, 0.05, 0.06, 'ironDark', 0, 0, 0, 0, 0, i * Math.PI / spokes);
  k.cyl(0.1, 0.1, 0.18, 'ironDark', 0, 0, 0, Math.PI / 2, 0, 0, 10);
  k.cyl(0.04, 0.04, 0.2, 'brass', 0, 0, 0, Math.PI / 2, 0, 0, 8);
}

export const WINDMILL_PARTS: Readonly<Record<string, PartBuilder>> = {
  // Sail shaft: an iron axle in a timber bearing block.
  shaft(k) {
    k.cyl(0.06, 0.06, 0.7, 'iron', 0, 0, 0, 0, 0, Math.PI / 2, 10);
    k.box(0.2, 0.22, 0.2, 'timberDark', -0.2, 0, 0);
    k.cyl(0.09, 0.09, 0.06, 'brass', -0.2, 0, 0.11, Math.PI / 2);
    k.cyl(0.1, 0.1, 0.05, 'ironDark', 0.33, 0, 0, 0, 0, Math.PI / 2, 10);
  },
  driver(k, _floor, facts) { gear(k, Number(facts.teeth) || 12, 'brass'); },
  driven(k, _floor, facts) { gear(k, Number(facts.teeth) || 24, 'iron'); },
  // Flanged coupling between the driven gear and the generator.
  coupling(k) {
    k.cyl(0.05, 0.05, 0.4, 'iron', 0, 0, 0, 0, 0, Math.PI / 2, 10);
    for (const x of [-0.1, 0.1]) k.cyl(0.12, 0.12, 0.05, 'ironDark', x, 0, 0, 0, 0, Math.PI / 2, 10);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; k.cyl(0.015, 0.015, 0.26, 'brass', 0, Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0, 0, Math.PI / 2, 6); }
  },
  // Generator: a finned dynamo with copper windings showing at the end cap.
  generator(k) {
    k.cyl(0.24, 0.24, 0.55, 'red', 0, 0, 0, 0, 0, Math.PI / 2, 14);
    for (let i = 0; i < 6; i++) k.ring(0.25, 0.015, 'ironDark', -0.2 + i * 0.08, 0, 0, 0, Math.PI / 2, 0);
    k.cyl(0.2, 0.2, 0.04, 'copper', 0.29, 0, 0, 0, 0, Math.PI / 2, 14);
    k.box(0.5, 0.06, 0.4, 'ironDark', 0, -0.26, 0);
    k.box(0.1, 0.08, 0.06, 'brass', 0, 0.26, 0.1);
  },
};
