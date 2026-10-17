import * as THREE from 'three';

/**
 * Low-poly prop pieces as plain position+colour geometry, so whole categories
 * merge into one draw call. Every helper returns non-indexed geometry with a
 * `color` attribute and (optionally) a parallel `lush` colour for recovery.
 */
export interface Piece { geometry: THREE.BufferGeometry; color: THREE.Color; lush?: THREE.Color }

const strip = (g: THREE.BufferGeometry): THREE.BufferGeometry => {
  const out = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(out.attributes)) if (name !== 'position') out.deleteAttribute(name);
  return out;
};

/** Paint and bake a list of pieces into one geometry with `color` and `lushColor`. */
export function bake(pieces: readonly Piece[], matrix?: THREE.Matrix4): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [], lush: number[] = [];
  for (const piece of pieces) {
    const g = strip(piece.geometry.clone());
    if (matrix) g.applyMatrix4(matrix);
    const p = g.getAttribute('position');
    const c = piece.color, l = piece.lush ?? piece.color;
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      colors.push(c.r, c.g, c.b);
      lush.push(l.r, l.g, l.b);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  out.setAttribute('lushColor', new THREE.Float32BufferAttribute(lush, 3));
  return out;
}

/** Concatenate baked geometries (same attribute layout). */
export function concat(list: readonly THREE.BufferGeometry[]): THREE.BufferGeometry {
  const names = ['position', 'color', 'lushColor'];
  const out = new THREE.BufferGeometry();
  for (const name of names) {
    const total = list.reduce((n, g) => n + g.getAttribute(name).array.length, 0);
    const arr = new Float32Array(total);
    let o = 0;
    for (const g of list) { arr.set(g.getAttribute(name).array as Float32Array, o); o += g.getAttribute(name).array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, 3));
  }
  return out;
}

const col = (hex: number) => new THREE.Color(hex);
const m4 = () => new THREE.Matrix4();
const place = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s: number | [number, number, number] = 1) => {
  const scale = Array.isArray(s) ? new THREE.Vector3(...s) : new THREE.Vector3(s, s, s);
  return g.applyMatrix4(m4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), scale));
};
function jitter(g: THREE.BufferGeometry, amount: number, seed: number): THREE.BufferGeometry {
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const k = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
    const r = (k - Math.floor(k)) - 0.5;
    p.setXYZ(i, p.getX(i) * (1 + r * amount), p.getY(i) * (1 + r * amount * 0.6), p.getZ(i) * (1 - r * amount));
  }
  return g;
}

export const PALETTE = {
  trunk: col(0x8a6a45), trunkDark: col(0x5e4029), palmLeaf: col(0x5aa64c), palmLeafDry: col(0x8f8a3a),
  leaf: col(0x4b9642), leaf2: col(0x5ea54e), leaf3: col(0x3f8239), leafDry: col(0xb8552c), leafDry2: col(0xcc8c38), leafDry3: col(0x8c8a38),
  pine: col(0x2f6b45), pineDry: col(0x2e5236), rock: col(0x928d82), rockDark: col(0x7c776d), moss: col(0x6f8f4f),
  grass: col(0x6cb04e), grassDry: col(0xa88d46), reed: col(0x7aa24a), reedDry: col(0xb09a5e), cattail: col(0x6a4a2c),
  plaster: col(0xf0e2c4), roofRed: col(0xb4553a), roofTeal: col(0x3e7d8c), roofOchre: col(0xc98a3a), door: col(0x6e4d30),
  window: col(0xffd27a), plank: col(0xa47a4c), plankDark: col(0x7a5636), stone: col(0x9a978c), debris: col(0x7c6a55),
  flower: [col(0xf2c14e), col(0xe86f68), col(0xf7f0e6), col(0xb889d6), col(0xf09a3e)],
};

export function palm(seed: number): Piece[] {
  const pieces: Piece[] = [];
  const lean = 0.16 + (seed % 3) * 0.07, dir = seed * 2.4;
  let y = 0, x = 0;
  const segs = 7 + (seed % 3);
  for (let i = 0; i < segs; i++) {
    const g = place(new THREE.CylinderGeometry(0.12 - i * 0.008, 0.16 - i * 0.008, 0.6, 6), x, y + 0.3, 0, 0, 0, -lean - i * 0.015);
    pieces.push({ geometry: g, color: i % 2 ? PALETTE.trunk : PALETTE.trunkDark });
    y += 0.57; x += Math.sin(lean + i * 0.015) * 0.6;
  }
  // Arched fronds: an inner and an outer blade per frond, with real width and a droop.
  for (let i = 0; i < 9; i++) {
    const yaw = (i / 9) * Math.PI * 2 + seed, rise = 0.55 + (i % 3) * 0.18, tone = i % 3 === 0 ? PALETTE.leaf3 : i % 2 ? PALETTE.palmLeaf : PALETTE.leaf2;
    const inner = new THREE.ConeGeometry(0.34, 1.3, 4, 1).translate(0, 0.65, 0).scale(1, 1, 0.18);
    const outer = new THREE.ConeGeometry(0.26, 1.2, 4, 1).translate(0, 0.6, 0).scale(1, 1, 0.16);
    place(inner, x, y, 0, 0, yaw, 1.57 - rise);
    const tipX = x + Math.cos(yaw) * Math.sin(1.57 - rise) * 1.25, tipY = y + Math.cos(1.57 - rise) * 1.25, tipZ = -Math.sin(yaw) * Math.sin(1.57 - rise) * 1.25;
    place(outer, tipX, tipY, tipZ, 0, yaw, 2.05 - rise * 0.4);
    pieces.push({ geometry: inner, color: PALETTE.palmLeafDry, lush: tone }, { geometry: outer, color: PALETTE.palmLeafDry, lush: tone });
  }
  for (let i = 0; i < 3; i++) pieces.push({ geometry: place(new THREE.IcosahedronGeometry(0.13, 0), x + Math.cos(i * 2.1) * 0.13, y - 0.17, Math.sin(i * 2.1) * 0.13), color: PALETTE.trunkDark });
  return pieces.map(p => ({ ...p, geometry: place(p.geometry, 0, 0, 0, 0, dir, 0) }));
}

/** Broad deciduous crown: one autumn tone per tree, shaded light-to-dark so masses read in blur. */
export function roundTree(seed: number): Piece[] {
  const lushSet = [PALETTE.leaf, PALETTE.leaf2, PALETTE.leaf3], drySet = [PALETTE.leafDry, PALETTE.leafDry2, PALETTE.leafDry3];
  const dry = drySet[seed % 3]!, lush = lushSet[seed % 3]!;
  const pieces: Piece[] = [
    { geometry: place(new THREE.CylinderGeometry(0.14, 0.24, 1.7, 6), 0, 0.85, 0), color: PALETTE.trunkDark },
    { geometry: place(new THREE.CylinderGeometry(0.06, 0.09, 0.9, 5), 0.25, 1.6, 0, 0, seed, -0.7), color: PALETTE.trunkDark },
  ];
  const blobs = 4 + (seed % 3);
  for (let i = 0; i < blobs; i++) {
    const a = seed + i * 2.4, r = i === 0 ? 0 : 0.55 + (i % 2) * 0.2, size = i === 0 ? 1.05 : 0.7 - (i % 3) * 0.08;
    const g = jitter(new THREE.IcosahedronGeometry(size, 0), 0.22, seed + i);
    place(g, Math.cos(a) * r, 2.1 + (i === 0 ? 0.3 : (i % 3) * 0.32 - 0.1), Math.sin(a) * r, seed, i, 0);
    const shade = i === 0 ? 0 : (i % 2 ? 0.07 : -0.08);
    pieces.push({ geometry: g, color: dry.clone().offsetHSL(0, 0, shade), lush: lush.clone().offsetHSL(0, 0, shade) });
  }
  return pieces;
}

export function pine(seed: number): Piece[] {
  const tiers = 4 + (seed % 2);
  const pieces: Piece[] = [{ geometry: place(new THREE.CylinderGeometry(0.1, 0.17, 1.1, 5), 0, 0.55, 0), color: PALETTE.trunkDark }];
  for (let i = 0; i < tiers; i++) {
    const g = jitter(new THREE.ConeGeometry(1.05 - i * 0.2, 1.15, 7), 0.08, seed + i);
    place(g, 0, 1.05 + i * 0.62, 0, 0, seed + i, 0);
    const shade = i % 2 ? 0.05 : -0.04;
    pieces.push({ geometry: g, color: PALETTE.pineDry.clone().offsetHSL(0, 0, shade), lush: (i === 1 ? PALETTE.leaf3 : PALETTE.pine).clone().offsetHSL(0, 0, shade) });
  }
  return pieces;
}

export function bush(seed: number): Piece[] {
  const pieces: Piece[] = [];
  const dry = [PALETTE.leafDry2, PALETTE.leafDry3, PALETTE.leafDry][seed % 3]!;
  for (let i = 0; i < 3; i++) {
    const g = jitter(new THREE.IcosahedronGeometry(0.46 - i * 0.08, 0), 0.25, seed + i * 3);
    place(g, Math.cos(seed + i * 2.2) * 0.32, 0.3 + (i === 0 ? 0.08 : 0), Math.sin(seed + i * 2.2) * 0.32, 0, seed, 0, [1, 0.78, 1]);
    pieces.push({ geometry: g, color: dry.clone().offsetHSL(0, 0, i ? -0.06 : 0.02), lush: i ? PALETTE.leaf2 : PALETTE.leaf });
  }
  return pieces;
}

/** Low fern clump for undergrowth. */
export function fern(seed: number): Piece[] {
  const pieces: Piece[] = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.ConeGeometry(0.11, 0.75, 3).translate(0, 0.37, 0).scale(1, 1, 0.3);
    place(g, 0, 0, 0, 0, seed + i * 1.05, 1.0 + (i % 2) * 0.25);
    pieces.push({ geometry: g, color: PALETTE.leafDry3, lush: i % 2 ? PALETTE.leaf : PALETTE.leaf3 });
  }
  return pieces;
}

export function rock(seed: number, size: number): Piece[] {
  const g = jitter(new THREE.IcosahedronGeometry(size, 0), 0.35, seed);
  place(g, 0, size * 0.25, 0, 0, seed, 0, [1, 0.62, 1]);
  const pieces: Piece[] = [{ geometry: g, color: seed % 3 ? PALETTE.rock : PALETTE.rockDark }];
  return pieces;
}

export function grassTuft(seed: number): Piece[] {
  const pieces: Piece[] = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.ConeGeometry(0.05, 0.42 + (i % 2) * 0.16, 3);
    place(g, Math.cos(seed + i * 1.7) * 0.1, 0.22, Math.sin(seed + i * 1.7) * 0.1, Math.sin(seed + i) * 0.35, 0, Math.cos(seed * 1.3 + i) * 0.35);
    pieces.push({ geometry: g, color: PALETTE.grassDry, lush: PALETTE.grass });
  }
  return pieces;
}

export function reeds(seed: number): Piece[] {
  const pieces: Piece[] = [];
  for (let i = 0; i < 6; i++) {
    const h = 0.9 + ((seed * 7 + i * 3) % 5) * 0.12;
    const a = seed + i * 1.1, r = 0.12 + (i % 3) * 0.08;
    pieces.push({ geometry: place(new THREE.CylinderGeometry(0.012, 0.02, h, 3), Math.cos(a) * r, h / 2, Math.sin(a) * r, Math.sin(a) * 0.12, 0, Math.cos(a) * 0.12), color: PALETTE.reedDry, lush: PALETTE.reed });
    if (i % 2 === 0) pieces.push({ geometry: place(new THREE.CylinderGeometry(0.035, 0.035, 0.18, 5), Math.cos(a) * r, h - 0.05, Math.sin(a) * r), color: PALETTE.cattail });
  }
  return pieces;
}

export function flowers(seed: number): Piece[] {
  const pieces: Piece[] = [];
  for (let i = 0; i < 6; i++) {
    const a = seed * 3.3 + i * 2.1, r = 0.12 + ((seed * 13 + i * 7) % 5) * 0.09;
    pieces.push({ geometry: place(new THREE.CylinderGeometry(0.01, 0.01, 0.24, 3), Math.cos(a) * r, 0.12, Math.sin(a) * r), color: PALETTE.grass });
    pieces.push({ geometry: place(new THREE.IcosahedronGeometry(0.065, 0), Math.cos(a) * r, 0.26, Math.sin(a) * r), color: PALETTE.flower[(seed + i) % PALETTE.flower.length]! });
  }
  return pieces;
}

function gableEnd(w: number, h: number, depth: number): THREE.BufferGeometry {
  const shape = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
}
function windowAt(x: number, y: number, z: number, ry: number, w = 0.42, h = 0.4): Piece[] {
  return [
    { geometry: place(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.05), x, y, z, 0, ry, 0), color: PALETTE.plankDark },
    { geometry: place(new THREE.BoxGeometry(w, h, 0.06), x, y, z, 0, ry, 0), color: PALETTE.window },
    { geometry: place(new THREE.BoxGeometry(0.04, h, 0.07), x, y, z, 0, ry, 0), color: PALETTE.plankDark },
    { geometry: place(new THREE.BoxGeometry(w + 0.2, 0.06, 0.12), x, y - h / 2 - 0.05, z, 0, ry, 0), color: PALETTE.plank },
  ];
}
function cornerBoards(w: number, d: number, h: number): Piece[] {
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => ({ geometry: place(new THREE.BoxGeometry(0.12, h, 0.12), sx! * w / 2, h / 2, sz! * d / 2), color: PALETTE.plank }));
}
function gableRoof(w: number, d: number, wallH: number, pitch: number, roof: THREE.Color): Piece[] {
  const rise = (w / 2) * pitch, slope = Math.hypot(w / 2 + 0.3, rise), angle = Math.atan2(rise, w / 2);
  const out: Piece[] = [{ geometry: place(gableEnd(w, rise, d), 0, wallH, 0), color: PALETTE.plaster }];
  for (const side of [-1, 1]) {
    out.push({ geometry: place(new THREE.BoxGeometry(slope, 0.12, d + 0.5), side * (w / 4 + 0.07), wallH + rise / 2 + 0.06, 0, 0, 0, -side * angle), color: roof });
    out.push({ geometry: place(new THREE.BoxGeometry(slope, 0.05, d + 0.52), side * (w / 4 + 0.07), wallH + rise / 2, 0, 0, 0, -side * angle), color: roof.clone().offsetHSL(0, 0, -0.12) });
  }
  out.push({ geometry: place(new THREE.BoxGeometry(0.16, 0.14, d + 0.55), 0, wallH + rise + 0.1, 0), color: roof.clone().offsetHSL(0, 0, -0.18) });
  return out;
}
const steps = (z: number, n = 2): Piece[] => Array.from({ length: n }, (_, i) => ({ geometry: place(new THREE.BoxGeometry(0.9, 0.1, 0.32), 0.45, 0.05 + i * 0.1, z + (n - i) * 0.26), color: PALETTE.stone }));

/** Four distinct village buildings so no house is a stamped duplicate. */
export function house(variant: number, roof: THREE.Color, seed: number): Piece[] {
  const out: Piece[] = [];
  if (variant === 0) { // gable cottage with porch
    const w = 2.6, d = 2.2, h = 1.6;
    out.push({ geometry: place(new THREE.BoxGeometry(w + 0.2, 0.2, d + 0.2), 0, 0.1, 0), color: PALETTE.stone },
      { geometry: place(new THREE.BoxGeometry(w, h, d), 0, 0.2 + h / 2, 0), color: PALETTE.plaster },
      ...cornerBoards(w, d, h + 0.2),
      ...gableRoof(w, d, h + 0.2, 0.75, roof),
      { geometry: place(new THREE.BoxGeometry(0.55, 0.95, 0.06), 0.55, 0.68, d / 2 + 0.01), color: PALETTE.door },
      ...windowAt(-0.6, 1.15, d / 2 + 0.02, 0), ...windowAt(w / 2 + 0.02, 1.15, 0, Math.PI / 2),
      { geometry: place(new THREE.BoxGeometry(w + 0.4, 0.08, 0.9), 0, 0.24, d / 2 + 0.45), color: PALETTE.plank },
      ...[-1, 1].map(sx => ({ geometry: place(new THREE.BoxGeometry(0.1, 1.5, 0.1), sx * (w / 2 + 0.1), 1.0, d / 2 + 0.85), color: PALETTE.plankDark })),
      { geometry: place(new THREE.BoxGeometry(w + 0.5, 0.08, 1.0), 0, 1.78, d / 2 + 0.45, 0.22, 0, 0), color: roof.clone().offsetHSL(0, 0, -0.06) },
      ...steps(d / 2 + 0.9, 2),
      { geometry: place(new THREE.BoxGeometry(0.34, 0.9, 0.34), -0.7, 2.6, -0.3), color: PALETTE.stone });
  } else if (variant === 1) { // pyramid roof with flower box
    const w = 2.4, d = 2.0, h = 1.6;
    out.push({ geometry: place(new THREE.BoxGeometry(w + 0.2, 0.18, d + 0.2), 0, 0.09, 0), color: PALETTE.stone },
      { geometry: place(new THREE.BoxGeometry(w, h, d), 0, 0.18 + h / 2, 0), color: PALETTE.plaster },
      ...cornerBoards(w, d, h + 0.18),
      { geometry: place(new THREE.BoxGeometry(w + 0.36, 0.12, d + 0.36), 0, h + 0.22, 0), color: PALETTE.plankDark },
      { geometry: place(new THREE.ConeGeometry(2.05, 1.35, 4), 0, h + 0.9, 0, 0, Math.PI / 4, 0, [1, 1, 0.86]), color: roof },
      { geometry: place(new THREE.ConeGeometry(0.3, 0.3, 4), 0, h + 1.62, 0, 0, Math.PI / 4, 0), color: roof.clone().offsetHSL(0, 0, -0.15) },
      { geometry: place(new THREE.BoxGeometry(0.55, 0.95, 0.06), 0.45, 0.66, d / 2 + 0.01), color: PALETTE.door },
      ...windowAt(-0.55, 1.12, d / 2 + 0.02, 0),
      { geometry: place(new THREE.BoxGeometry(0.6, 0.16, 0.2), -0.55, 0.8, d / 2 + 0.12), color: PALETTE.plankDark },
      ...[0, 1, 2].map(i => ({ geometry: place(new THREE.IcosahedronGeometry(0.08, 0), -0.75 + i * 0.2, 0.92, d / 2 + 0.14), color: PALETTE.flower[(seed + i) % 5]! })),
      ...steps(d / 2 + 0.05, 1),
      { geometry: place(new THREE.BoxGeometry(0.18, 0.7, 0.18), 0.7, h + 1.0, -0.35), color: PALETTE.stone });
  } else if (variant === 2) { // two-storey with balcony
    const w = 2.1, d = 2.0, h = 2.8;
    out.push({ geometry: place(new THREE.BoxGeometry(w + 0.2, 0.2, d + 0.2), 0, 0.1, 0), color: PALETTE.stone },
      { geometry: place(new THREE.BoxGeometry(w, h, d), 0, 0.2 + h / 2, 0), color: PALETTE.plaster },
      { geometry: place(new THREE.BoxGeometry(w + 0.04, 0.1, d + 0.04), 0, 1.6, 0), color: PALETTE.plank },
      ...cornerBoards(w, d, h + 0.2),
      ...gableRoof(w, d, h + 0.2, 0.95, roof),
      { geometry: place(new THREE.BoxGeometry(0.55, 0.95, 0.06), -0.45, 0.68, d / 2 + 0.01), color: PALETTE.door },
      ...windowAt(0.5, 1.05, d / 2 + 0.02, 0), ...windowAt(-0.45, 2.3, d / 2 + 0.02, 0), ...windowAt(0.5, 2.3, d / 2 + 0.02, 0),
      { geometry: place(new THREE.BoxGeometry(w + 0.1, 0.08, 0.6), 0, 1.7, d / 2 + 0.3), color: PALETTE.plank },
      { geometry: place(new THREE.BoxGeometry(w + 0.1, 0.06, 0.06), 0, 2.15, d / 2 + 0.58), color: PALETTE.plankDark },
      ...[-0.9, -0.3, 0.3, 0.9].map(x => ({ geometry: place(new THREE.BoxGeometry(0.05, 0.45, 0.05), x, 1.93, d / 2 + 0.58), color: PALETTE.plankDark })),
      ...steps(d / 2 + 0.05, 1));
  } else { // lean-to workshop
    const w = 2.8, d = 2.0, h = 1.9;
    out.push({ geometry: place(new THREE.BoxGeometry(w + 0.2, 0.16, d + 0.2), 0, 0.08, 0), color: PALETTE.stone },
      { geometry: place(new THREE.BoxGeometry(w, h, 0.18), 0, 0.16 + h / 2, -d / 2 + 0.09), color: PALETTE.plank },
      { geometry: place(new THREE.BoxGeometry(0.18, h, d), -w / 2 + 0.09, 0.16 + h / 2, 0), color: PALETTE.plank },
      { geometry: place(new THREE.BoxGeometry(0.18, h, d), w / 2 - 0.09, 0.16 + h / 2, 0), color: PALETTE.plankDark },
      ...[-1, 1].map(sx => ({ geometry: place(new THREE.BoxGeometry(0.14, h - 0.3, 0.14), sx * (w / 2 - 0.3), 0.16 + (h - 0.3) / 2, d / 2 - 0.1), color: PALETTE.trunkDark })),
      { geometry: place(new THREE.BoxGeometry(w + 0.5, 0.12, d + 0.7), 0, h + 0.1, 0.1, 0.22, 0, 0), color: roof },
      { geometry: place(new THREE.BoxGeometry(1.0, 0.08, 0.5), 0, 0.85, -d / 2 + 0.4), color: PALETTE.plank },
      ...[0, 1].map(i => ({ geometry: place(new THREE.BoxGeometry(0.5, 0.45, 0.5), -0.8 + i * 0.55, 0.39, 0.2 + i * 0.2, 0, i * 0.4, 0), color: i ? PALETTE.plank : PALETTE.plankDark })));
  }
  return out;
}

export function pier(length: number, halfWidth: number): Piece[] {
  const pieces: Piece[] = [];
  for (let z = 0; z < length; z += 0.5) {
    pieces.push({ geometry: place(new THREE.BoxGeometry(halfWidth * 2, 0.08, 0.44), 0, -0.04, z + 0.25, 0, (Math.sin(z * 7) * 0.02), 0), color: (Math.floor(z * 2) % 3) ? PALETTE.plank : PALETTE.plankDark });
  }
  for (let z = 0.4; z < length; z += 2.2) for (const x of [-halfWidth + 0.12, halfWidth - 0.12]) {
    pieces.push({ geometry: place(new THREE.CylinderGeometry(0.11, 0.13, 3.6, 6), x, -1.75, z), color: PALETTE.trunkDark });
  }
  for (const x of [-halfWidth + 0.06, halfWidth - 0.06]) pieces.push({ geometry: place(new THREE.BoxGeometry(0.1, 0.1, length), x, 0.55, length / 2), color: PALETTE.plankDark });
  for (let z = 0.4; z < length; z += 2.2) for (const x of [-halfWidth + 0.06, halfWidth - 0.06]) pieces.push({ geometry: place(new THREE.BoxGeometry(0.09, 0.6, 0.09), x, 0.28, z), color: PALETTE.plankDark });
  return pieces;
}

export function firePit(): Piece[] {
  const pieces: Piece[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    pieces.push({ geometry: place(jitter(new THREE.IcosahedronGeometry(0.22, 0), 0.3, i), Math.cos(a) * 0.62, 0.08, Math.sin(a) * 0.62, 0, 0, 0, [1, 0.6, 1]), color: i % 2 ? PALETTE.stone : PALETTE.rockDark });
  }
  for (let i = 0; i < 3; i++) pieces.push({ geometry: place(new THREE.CylinderGeometry(0.07, 0.08, 0.9, 6), 0, 0.12, 0, Math.PI / 2 - 0.3, (i / 3) * Math.PI * 2, 0), color: PALETTE.debris });
  // The council's log seats are placed with each member (council-circle.ts) so they always sit on one.
  return pieces;
}

/** Storm debris: snapped planks, a fallen branch and loose stones. Cleared when a site is restored. */
export function debris(seed: number): Piece[] {
  const pieces: Piece[] = [];
  for (let i = 0; i < 3; i++) pieces.push({ geometry: place(new THREE.BoxGeometry(1.1 - i * 0.2, 0.06, 0.16), (i - 1) * 0.3, 0.05 + i * 0.05, Math.sin(seed + i) * 0.3, 0.1 * i, seed + i * 0.7, 0.15 * (i - 1)), color: i % 2 ? PALETTE.plank : PALETTE.plankDark });
  pieces.push({ geometry: place(new THREE.CylinderGeometry(0.06, 0.1, 1.6, 5), 0.7, 0.08, 0.5, 0, seed * 1.3, Math.PI / 2), color: PALETTE.trunkDark });
  pieces.push({ geometry: place(new THREE.ConeGeometry(0.22, 0.5, 4), 1.4, 0.15, 0.6, 0, seed, Math.PI / 2), color: PALETTE.leafDry });
  pieces.push({ geometry: place(jitter(new THREE.IcosahedronGeometry(0.16, 0), 0.4, seed), -0.6, 0.06, -0.4), color: PALETTE.rockDark });
  return pieces;
}
