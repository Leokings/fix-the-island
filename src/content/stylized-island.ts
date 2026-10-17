/**
 * Authored layout and height field for the stylized island (GAME-DESIGN §12).
 * Pure data and maths: no Three.js, so the walk surface can be tested in Node.
 * Gameplay reads only the LevelData built from this; meshes never grant progress.
 */
export interface Point { readonly x: number; readonly z: number }

export const ISLAND_LEVEL_ID = 'stylized-island-v1';
export const ISLAND_CENTRE: Point = { x: 0, z: -3 };
export const SEA_LEVEL = 0;

/** Site anchors. Coast in the south, village and creek in the middle, woodland and ridge north. */
export const SITE_ANCHORS: Readonly<Record<string, Point>> = Object.freeze({
  pier_hoist: { x: -13, z: 17 },
  village_pump: { x: -10, z: 2.5 },
  tidal_sluice: { x: 13, z: 16 },
  creek_bridge: { x: -3, z: 0 },
  coast_windmill: { x: 19, z: -5 },
  woodland_pathlight: { x: 5, z: -12 },
  upland_waterworks: { x: -13.8, z: -14.8 },
  ridge_beacon: { x: -2, z: -25 },
});
/** Flattened work pad radius per site (matches service clearances). */
export const PAD_RADIUS: Readonly<Record<string, number>> = Object.freeze({
  pier_hoist: 5, village_pump: 5, tidal_sluice: 4.6, creek_bridge: 6.8, coast_windmill: 5.4,
  woodland_pathlight: 4.8, upland_waterworks: 4.8, ridge_beacon: 4.6,
});
export const SPAWN: Point = { x: -10.2, z: 18.6 };
/** The Headland Windmill's mounting places: the service pad back from the cliff by the track, and the
 * bluff pad on the seaward edge above the gull nesting ledge, which lies on the terrace 3 m below. */
const windmillAt = (deg: number, r: number): Point => { const a = deg * Math.PI / 180, c = SITE_ANCHORS.coast_windmill!; return { x: c.x + Math.sin(a) * r, z: c.z + Math.cos(a) * r }; };
export const WINDMILL_PADS: Readonly<Record<'service_pad' | 'bluff_pad', Point>> = Object.freeze({ service_pad: windmillAt(240, 4.8), bluff_pad: windmillAt(125, 5.7) });
export const GULL_LEDGE: Point = windmillAt(125, 8.9);
/** Village houses (position and facing). Each sits on its own levelled pad. */
export const HOUSES: readonly { x: number; z: number; ry: number }[] = Object.freeze([
  // Placed clear of every footpath ramp (paths are narrow walkways cut into the plateaus).
  { x: -16, z: 6.2, ry: 0.5 }, { x: -6.4, z: 6.9, ry: -0.35 }, { x: -15.1, z: 11.1, ry: 0.15 }, { x: -19.5, z: 1.8, ry: 1.1 },
]);
/** The village core is one walkable level around the pump; cliffs stand at its edges. */
const VILLAGE = { x: -11.5, z: 5.5, r: 6.5 };

/** Village commons beside the pump, reserved for the council fire. */
export const COMMONS: Point = { x: -15.6, z: -0.4 };
/** The village's public trough, beside the path between the pump and the houses. */
export const TROUGH: Point & { ry: number } = { x: -13.3, z: 5.1, ry: 0.55 };
/**
 * Council seats: a half-circle on the far side of the fire from the fixed camera
 * (camera looks along yaw 35°), so every member faces the player's view.
 */
export const COUNCIL_SEATS: Readonly<Record<'fisher' | 'farmer' | 'engineer' | 'elder', Point & { angle: number }>> = Object.freeze(Object.fromEntries(
  ([['fisher', -3.45], ['farmer', -2.6], ['engineer', -1.75], ['elder', -0.9]] as const).map(([role, angle]) =>
    [role, { x: COMMONS.x + Math.cos(angle) * 2.05, z: COMMONS.z + Math.sin(angle) * 2.05, angle }]),
) as Record<'fisher' | 'farmer' | 'engineer' | 'elder', Point & { angle: number }>);

/** The creek runs from the upland spring, past the village, under the bridge and out at the sluice. */
export const CREEK: readonly (Point & { readonly w: number })[] = Object.freeze([
  // The spring emerges at the foot of the upland cliff, below the waterworks.
  { x: -17.2, z: -9.6, w: 0.9 },
  { x: -15, z: -8, w: 1.0 },
  { x: -8, z: -4.6, w: 1.25 },
  { x: -3, z: -3.6, w: 1.6 },
  { x: -3, z: 3.6, w: 1.7 },
  { x: 3, z: 7.6, w: 1.7 },
  { x: 9, z: 11, w: 1.8 },
  { x: 14.5, z: 12.4, w: 1.9 },
  { x: 20, z: 15, w: 2.1 },
  { x: 27, z: 18, w: 2.4 },
]);
/** An always-open shallow stone ford, so no repair can lock the player out of land. */
export const FORD: Point = { x: -11.5, z: -6.3 };
export const FORD_RADIUS = 1.9;

/** Junction on the creek's north bank where the upland and woodland paths leave the ford. */
export const NORTH_BANK: Point = { x: -8, z: -9.8 };
/** Where the climb tops out: paths split to the waterworks bowl and on to the beacon. */
export const UPLAND_GATE: Point = { x: -4.6, z: -20 };
/** East of the north bank the path forks: woodland ahead, the climb to the ridge to the left. */
export const WOOD_FORK: Point = { x: -3.5, z: -10.8 };

/** Bridge deck walk strip across the creek; opens only once the bridge is restored. */
export const BRIDGE_DECK = Object.freeze({ minX: -7.6, maxX: 1.6, minZ: -1.15, maxZ: 1.15, lift: 0.18 });
/** A walkable timber pier from the landing beach out to sea. */
export const PIER = Object.freeze({ x: -13, fromZ: 20.2, toZ: 30.5, halfWidth: 1.25 });

/** Footpaths: visual guidance on the ground; trees and rocks keep off them. */
export const PATHS: readonly (readonly Point[])[] = Object.freeze([
  // Split at every junction so the paths meeting there share one pinned height.
  [SPAWN, { x: -9.4, z: 14.4 }, { x: -11, z: 8 }],
  [{ x: -11, z: 8 }, SITE_ANCHORS.village_pump!],
  [SITE_ANCHORS.village_pump!, { x: -12.5, z: -2.5 }, FORD],
  // From the ford a short ramp reaches the north bank; a long, wide climb then reaches the upland.
  [FORD, NORTH_BANK],
  [NORTH_BANK, WOOD_FORK],
  [WOOD_FORK, { x: 0.2, z: -14.2 }, { x: 1.3, z: -17 }, { x: 0.6, z: -19.1 }, { x: -1.6, z: -20.2 }, UPLAND_GATE],
  [UPLAND_GATE, { x: -7.6, z: -18 }, SITE_ANCHORS.upland_waterworks!],
  [UPLAND_GATE, SITE_ANCHORS.ridge_beacon!],
  [WOOD_FORK, { x: 0.8, z: -11.2 }, SITE_ANCHORS.woodland_pathlight!],
  [SITE_ANCHORS.woodland_pathlight!, { x: 11, z: -9 }, SITE_ANCHORS.coast_windmill!],
  [SITE_ANCHORS.village_pump!, { x: -7.6, z: 0 }],
  [{ x: 1.6, z: 0 }, { x: 4, z: -5 }, SITE_ANCHORS.woodland_pathlight!],
  [SPAWN, { x: -4, z: 17.5 }, { x: 4, z: 17 }, SITE_ANCHORS.tidal_sluice!],
  [{ x: -11, z: 8 }, { x: -4, z: 9.5 }, { x: 4, z: 12.5 }, SITE_ANCHORS.tidal_sluice!],
  [SITE_ANCHORS.village_pump!, COMMONS],
]);

// ——— Maths ———
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const smoothstep = (a: number, b: number, t: number) => { const k = clamp((t - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
function hash(x: number, z: number): number { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x: number, z: number) => noise(x, z) * 0.6 + noise(x * 2.1 + 5.2, z * 2.1) * 0.3 + noise(x * 4.3, z * 4.3 + 1.7) * 0.1;
export const rand = hash;

export function segmentDistance(p: Point, a: Point, b: Point): { d: number; t: number } {
  const dx = b.x - a.x, dz = b.z - a.z, len = dx * dx + dz * dz;
  const t = len ? clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / len, 0, 1) : 0;
  return { d: Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t), t };
}
export function polylineDistance(p: Point, line: readonly Point[]): number {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) best = Math.min(best, segmentDistance(p, line[i]!, line[i + 1]!).d);
  return best;
}
export const pathDistance = (p: Point) => Math.min(...PATHS.map(line => polylineDistance(p, line)));

/** Signed distance inside the coastline (positive on land). */
export function coastDistance(x: number, z: number): number {
  const dx = x - ISLAND_CENTRE.x, dz = z - ISLAND_CENTRE.z, a = Math.atan2(dz, dx);
  const ellipse = 1 / Math.hypot(Math.cos(a) / 31, Math.sin(a) / 28.5);
  const wobble = (noise(Math.cos(a) * 2.2 + 3, Math.sin(a) * 2.2 + 7) - 0.5) * 7 + Math.sin(a * 3 + 0.8) * 1.6;
  // A sheltered bay for the landing, a headland bulge for the windmill.
  const bay = -2.2 * Math.exp(-((a - 1.95) ** 2) / 0.03);
  const headland = 3.5 * Math.exp(-((a + 0.08) ** 2) / 0.06);
  return ellipse + wobble + bay + headland - Math.hypot(dx, dz);
}

const bump = (x: number, z: number, cx: number, cz: number, amp: number, sigma: number) =>
  amp * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * sigma * sigma));

/** Rolling land before it is cut into plateaus. Regions: beach < village shelf < woodland/headland < upland/beacon. */
function rolling(x: number, z: number): number {
  const d = coastDistance(x, z);
  let h: number;
  if (d < 0) h = -0.25 + d * 0.45;
  else if (d < 6) h = 0.04 + d * 0.07;
  else h = 0.46 + Math.min(d - 6, 10) * 0.12;
  const inland = smoothstep(3, 10, d);
  let hills = 0;
  hills += bump(x, z, -11, 4, 2.6, 6.5); // village shelf
  hills += bump(x, z, -15, -16, 9.5, 5.6); // upland bowl
  // A high rim behind the waterworks (up-screen) makes the upland a bowl: no sea in view from it.
  hills += bump(x, z, -19.5, -19.5, 13, 4.2); // west rim
  hills += bump(x, z, -12.5, -21.8, 12, 3.8); // north rim
  hills += bump(x, z, -21, -13, 9, 3.4); // west shoulder
  hills += bump(x, z, -2, -25, 10, 5.5); // beacon crown
  hills += bump(x, z, 5, -13, 5.5, 8); // woodland rise
  hills += bump(x, z, 19, -5, 5.5, 6); // windmill headland
  hills += (fbm(x * 0.12 + 4, z * 0.12) - 0.5) * 1.2;
  // Bluffs set a floor near the coast (a cliff edge), they do not lift land that is already high.
  const b = bluff(x, z, d);
  return b > 0 ? Math.max(h + hills * inland, b) : h + hills * inland;
}

/** Cliff-backed coasts on the wilder shores; the landing cove and creek mouth keep open beaches. */
function bluff(x: number, z: number, d: number): number {
  const a = Math.atan2(z - ISLAND_CENTRE.z, x - ISLAND_CENTRE.x);
  const wild = smoothstep(0.38, 0.55, noise(Math.cos(a) * 1.7 + 8, Math.sin(a) * 1.7 - 2));
  const open = Math.max(Math.exp(-((a - 1.95) ** 2) / 0.05), Math.exp(-((a - 0.75) ** 2) / 0.06));
  // The landing cove is held between cliffs: strong bluffs either side of its open beach.
  const coveArms = Math.exp(-((a - 1.65) ** 2) / 0.02) + Math.exp(-((a - 2.3) ** 2) / 0.02);
  return 3.7 * Math.min(1, wild + coveArms) * (1 - open) * smoothstep(2.4, 3.8, d) * (1 - smoothstep(9, 13, d));
}

/** Plateaus separated by real cliffs: heights snap to levels with a short, steep riser between them. */
export const TERRACE_STEP = 3.0;
const TERRACE_BASE = 0.6;
function natural(x: number, z: number): number {
  const h = rolling(x, z);
  if (h <= TERRACE_BASE) return Math.max(-3.2, h);
  const jitter = (fbm(x * 0.09 + 11, z * 0.09) - 0.5) * 0.35;
  const t = (h - TERRACE_BASE) / TERRACE_STEP + jitter, i = Math.floor(t), f = t - i;
  return TERRACE_BASE + (i + smoothstep(0.9, 1, f)) * TERRACE_STEP;
}

interface Pad { readonly x: number; readonly z: number; readonly r: number; readonly y: number }
let padCache: readonly Pad[] | null = null;
function pads(): readonly Pad[] {
  // The landing (hoist, spawn, pier foot) is pinned to low beach height so the cove keeps a real beach.
  const LANDING_Y = 0.45;
  // The waterworks sits on the floor of the upland bowl, below its rim.
  const UPLAND_Y = TERRACE_BASE + 4 * TERRACE_STEP;
  const village = natural(SITE_ANCHORS.village_pump!.x, SITE_ANCHORS.village_pump!.z);
  return padCache ??= Object.entries(SITE_ANCHORS).map(([id, p]) => ({ ...p, r: PAD_RADIUS[id]!, y: id === 'pier_hoist' ? LANDING_Y : id === 'upland_waterworks' ? UPLAND_Y : natural(p.x, p.z) }))
    .concat([{ ...COMMONS, r: 3.2, y: village }, { ...SPAWN, r: 2.6, y: LANDING_Y }, { ...VILLAGE, y: village },
      ...HOUSES.map(h => ({ x: h.x, z: h.z, r: 2.3, y: village })),
      { x: PIER.x, z: PIER.fromZ + 0.8, r: 2.4, y: LANDING_Y - 0.03 }]);
}

/** Plateau land with work pads levelled (no creek, no path ramps). */
function padded(x: number, z: number): number {
  let h = natural(x, z);
  for (const pad of pads()) {
    const w = 1 - smoothstep(pad.r, pad.r + 2.4, Math.hypot(x - pad.x, z - pad.z));
    if (w > 0) h = h + (pad.y - h) * w;
  }
  return h;
}

// ——— Creek: a canyon that only ever runs downhill ———
interface CreekSample extends Point { readonly w: number; readonly top: number; readonly s: number }
let creekCache: readonly CreekSample[] | null = null;
/** Samples every 0.35 m along the creek; the top is the running minimum of the land, so water never climbs. */
export function creekProfile(): readonly CreekSample[] {
  if (creekCache) return creekCache;
  const out: CreekSample[] = [];
  let top = Infinity, s = 0;
  for (let i = 0; i < CREEK.length - 1; i++) {
    const a = CREEK[i]!, b = CREEK[i + 1]!, len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(len / 0.35);
    for (let k = 0; k < n; k++) {
      const t = k / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      top = Math.min(top, padded(x, z));
      out.push({ x, z, w: a.w + (b.w - a.w) * t, top: Math.max(top, 0.05), s });
      s += len / n;
    }
  }
  const last = CREEK.at(-1)!;
  out.push({ x: last.x, z: last.z, w: last.w, top: Math.max(0.05, Math.min(top, padded(last.x, last.z))), s });
  return creekCache = out;
}
/** Water sits this far below the creek top: low and murky in the storm, higher once flowing. */
export const CREEK_WATER_DROP = { storm: 1.55, flowing: 1.15 } as const;
const CREEK_BED = 2.0;
/** Nearest creek sample: distance to the centre line, half-width and the creek top there. */
export function creekInfo(p: Point): { d: number; w: number; top: number } {
  let d = Infinity, w = 1;
  for (let i = 0; i < CREEK.length - 1; i++) {
    const a = CREEK[i]!, b = CREEK[i + 1]!, sd = segmentDistance(p, a, b);
    if (sd.d < d) { d = sd.d; w = a.w + (b.w - a.w) * sd.t; }
  }
  if (d > 12) return { d, w, top: 0 };
  // Creek top from the nearest profile sample (coarse search, then exact).
  const prof = creekProfile();
  let bi = 0, bd = Infinity;
  for (let i = 0; i < prof.length; i += 4) { const q = prof[i]!, dd = (q.x - p.x) ** 2 + (q.z - p.z) ** 2; if (dd < bd) { bd = dd; bi = i; } }
  for (let i = Math.max(0, bi - 4); i < Math.min(prof.length, bi + 5); i++) { const q = prof[i]!, dd = (q.x - p.x) ** 2 + (q.z - p.z) ** 2; if (dd < bd) { bd = dd; bi = i; } }
  return { d, w, top: prof[bi]!.top };
}
/** Creek top at a point (for the water surface). */
export const creekTop = (x: number, z: number) => creekInfo({ x, z }).top;

function withCreek(x: number, z: number, h: number): number {
  const c = creekInfo({ x, z });
  if (c.d > c.w + 3) return h;
  const ford = Math.hypot(x - FORD.x, z - FORD.z);
  // The ford raises the bed so stepping stones stand just out of the storm water.
  const lift = (CREEK_BED - CREEK_WATER_DROP.storm + 0.12) * (1 - smoothstep(FORD_RADIUS - 0.3, FORD_RADIUS + 0.8, ford));
  const bed = c.top - CREEK_BED + lift;
  // Steep banks: flat bed inside the channel, rising to the land over about a metre.
  const cut = bed + (h - bed) * smoothstep(c.w * 0.85, c.w + 1.1, c.d);
  return Math.min(h, cut);
}

// ——— Footpaths: graded ramps cut through the cliffs ———
const MAX_GRADE = 0.42;
interface PathProfile { readonly pts: readonly Point[]; readonly heights: readonly number[] }
let pathCache: readonly PathProfile[] | null = null;
function pathProfiles(): readonly PathProfile[] {
  if (pathCache) return pathCache;
  return pathCache = PATHS.map(line => {
    const pts: Point[] = [];
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i]!, b = line[i + 1]!, n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.4));
      for (let k = 0; k < n; k++) pts.push({ x: a.x + (b.x - a.x) * k / n, z: a.z + (b.z - a.z) * k / n });
    }
    pts.push(line.at(-1)!);
    const raw = pts.map(p => withCreek(p.x, p.z, padded(p.x, p.z)));
    const ds = pts.map((p, i) => i ? Math.hypot(p.x - pts[i - 1]!.x, p.z - pts[i - 1]!.z) : 0);
    // Grade-limited profile with both ends pinned to the true ground, so paths meeting at a junction agree.
    // 1) keep every point inside the cone both ends can reach at MAX_GRADE; 2) relax against both neighbours.
    const n = raw.length - 1, cum = ds.map((_, i) => ds.slice(0, i + 1).reduce((t, v) => t + v, 0)), total = cum[n]!;
    const h = raw.map((r, i) => {
      const lo = Math.max(raw[0]! - MAX_GRADE * cum[i]!, raw[n]! - MAX_GRADE * (total - cum[i]!));
      const hi = Math.min(raw[0]! + MAX_GRADE * cum[i]!, raw[n]! + MAX_GRADE * (total - cum[i]!));
      return lo <= hi ? clamp(r, lo, hi) : raw[0]! + (raw[n]! - raw[0]!) * (cum[i]! / total);
    });
    // Flat landings at both ends: every path meeting a junction is level there, at the same pinned height.
    const LANDING = 1.4;
    let first = 1, last = n - 1;
    while (first < n && cum[first]! <= LANDING) h[first++] = raw[0]!;
    while (last > first && total - cum[last]! <= LANDING) h[last--] = raw[n]!;
    for (let pass = 0; pass < 300; pass++) {
      for (let i = first; i <= last; i++) {
        const lo = Math.max(h[i - 1]! - MAX_GRADE * ds[i]!, h[i + 1]! - MAX_GRADE * ds[i + 1]!);
        const hi = Math.min(h[i - 1]! + MAX_GRADE * ds[i]!, h[i + 1]! + MAX_GRADE * ds[i + 1]!);
        h[i] = lo <= hi ? clamp(h[i]!, lo, hi) : (lo + hi) / 2;
      }
    }
    return { pts, heights: h };
  });
}
// Spatial index of graded path segments: every segment within 4 m of a cell, in path order,
// so a lookup visits only nearby segments yet blends exactly as a full scan would.
const PATH_CELL = 2, PATH_REACH = 4;
interface PathSeg { ax: number; az: number; dx: number; dz: number; len2: number; ya: number; yb: number }
let pathIndex: Map<number, PathSeg[]> | null = null;
const cellKey = (cx: number, cz: number) => (cx + 512) * 1024 + (cz + 512);
function pathSegments(): Map<number, PathSeg[]> {
  if (pathIndex) return pathIndex;
  pathIndex = new Map();
  for (const prof of pathProfiles()) for (let i = 0; i < prof.pts.length - 1; i++) {
    const a = prof.pts[i]!, b = prof.pts[i + 1]!, dx = b.x - a.x, dz = b.z - a.z;
    const seg: PathSeg = { ax: a.x, az: a.z, dx, dz, len2: dx * dx + dz * dz, ya: prof.heights[i]!, yb: prof.heights[i + 1]! };
    const x0 = Math.floor((Math.min(a.x, b.x) - PATH_REACH) / PATH_CELL), x1 = Math.floor((Math.max(a.x, b.x) + PATH_REACH) / PATH_CELL);
    const z0 = Math.floor((Math.min(a.z, b.z) - PATH_REACH) / PATH_CELL), z1 = Math.floor((Math.max(a.z, b.z) + PATH_REACH) / PATH_CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const key = cellKey(cx, cz), list = pathIndex.get(key);
      if (list) list.push(seg); else pathIndex.set(key, [seg]);
    }
  }
  return pathIndex;
}
const nearD: number[] = [], nearY: number[] = [];
/** Nearest footpath: distance and the graded height there. */
function nearestPath(p: Point): { d: number; y: number } {
  // Soft-min over every nearby segment: where the nearest segment changes (corners, junctions) the
  // height blends smoothly instead of creasing into a too-steep facet.
  const list = pathSegments().get(cellKey(Math.floor(p.x / PATH_CELL), Math.floor(p.z / PATH_CELL)));
  if (!list) return { d: Infinity, y: 0 };
  let count = 0, dmin = Infinity;
  for (const s of list) {
    const t = s.len2 ? clamp(((p.x - s.ax) * s.dx + (p.z - s.az) * s.dz) / s.len2, 0, 1) : 0;
    const d = Math.hypot(p.x - s.ax - s.dx * t, p.z - s.az - s.dz * t);
    if (d < PATH_REACH) { nearD[count] = d; nearY[count] = s.ya + (s.yb - s.ya) * t; count++; if (d < dmin) dmin = d; }
  }
  if (!count) return { d: Infinity, y: 0 };
  let wsum = 0, ysum = 0;
  for (let i = 0; i < count; i++) { const w = Math.exp(-(nearD[i]! - dmin) / 0.35); wsum += w; ysum += w * nearY[i]!; }
  return { d: dmin, y: ysum / wsum };
}

/** Land height before the creek channel (plateaus + pads). Used for the bridge pad. */
export function landHeight(x: number, z: number): number { return padded(x, z); }

export function groundHeight(x: number, z: number): number {
  const h = withCreek(x, z, padded(x, z));
  const p = nearestPath({ x, z });
  if (p.d > 3.4) return h;
  // A level walkway about 3.2 m wide, with steep cut or fill sides back to the plateau.
  return p.y + (h - p.y) * smoothstep(1.6, 3.0, p.d);
}

/** Depth the creek cuts into the land at a point (0 away from the creek). */
export function creekCarve(x: number, z: number): number {
  const h = padded(x, z);
  return Math.max(0, h - withCreek(x, z, h));
}

/** True where the ground is wet (creek water or sea), so it is not part of the walk surface. */
export function isWet(x: number, z: number, y = groundHeight(x, z)): boolean {
  if (y < SEA_LEVEL + 0.1) return true;
  const c = creekInfo({ x, z });
  return c.d < c.w + 1.5 && y < c.top - CREEK_WATER_DROP.storm + 0.08;
}

export type Biome = 'beach' | 'grass' | 'woodland' | 'upland' | 'rock' | 'path' | 'mud';
/** Base land biome, before soft path and creek-bed overlays. */
export function biomeAt(x: number, z: number, y: number, slope: number): Biome {
  const coast = coastDistance(x, z);
  if (slope > 0.62) return 'rock';
  if (coast < 5.5 && y < 0.75) return 'beach';
  if (y > 7) return 'upland';
  if (z < -6 && y > 2.5) return 'woodland';
  return 'grass';
}
/** Soft overlay weights (0..1) for footpaths and the wet creek bed. */
export function overlayAt(x: number, z: number): { path: number; mud: number } {
  return { path: 1 - smoothstep(0.35, 0.9, pathDistance({ x, z })), mud: smoothstep(0.2, 0.8, creekCarve(x, z)) };
}
