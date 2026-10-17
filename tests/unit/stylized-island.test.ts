import { describe, it, expect } from 'vitest';
import { buildStylizedIsland } from '../../src/render/island/stylized-world';
import { collidingObstacles, dryStandingGround, sampleGround, type LevelData, type Vec3 } from '../../src/domain/terrain';
import { World, focusSite } from '../../src/domain/world';
import { REPAIR_SCENARIOS } from '../../src/genlayer';
import { FORD, PATHS, SITE_ANCHORS, groundHeight } from '../../src/content/stylized-island';

const island = buildStylizedIsland();
const level = island.level;

/** Flood-fill the walk surface from spawn using the same step and collision rules as movement. */
function reachable(level: LevelData, restored: ReadonlySet<string>, step = 0.5): Map<string, Vec3> {
  const key = (x: number, z: number) => `${Math.round(x / step)},${Math.round(z / step)}`;
  const seen = new Map<string, Vec3>(), queue: Vec3[] = [level.spawn];
  seen.set(key(level.spawn.x, level.spawn.z), level.spawn);
  while (queue.length) {
    const from = queue.pop()!;
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]] as const) {
      const x = from.x + dx, z = from.z + dz, k = key(x, z);
      if (seen.has(k)) continue;
      const ground = dryStandingGround(level, { x, y: from.y, z }, restored);
      // Same slope limit as movement (38 degrees): no hopping down a cliff between samples.
      if (!ground || Math.abs(ground.y - from.y) > step * Math.tan(38 * Math.PI / 180)) continue;
      const to = { x, y: ground.y, z };
      if (collidingObstacles(level, from, to, restored).length) continue;
      seen.set(k, to); queue.push(to);
    }
  }
  return seen;
}
const near = (cells: Map<string, Vec3>, p: { x: number; z: number }, r: number) => [...cells.values()].some(c => Math.hypot(c.x - p.x, c.z - p.z) < r);

describe('stylized island walk surface', () => {
  const open = reachable(level, new Set());

  it('spawns on dry standing ground at the landing', () => {
    expect(dryStandingGround(level, level.spawn)).not.toBeNull();
    expect(level.spawn.y).toBeLessThan(1.2);
  });

  it('reaches every repair site from the landing before any repair (land never locks)', () => {
    for (const [id, p] of Object.entries(SITE_ANCHORS)) expect(near(open, p, id === 'creek_bridge' ? 6 : 3.4), id).toBe(true);
  });

  it('crosses the creek at the always-open ford', () => {
    expect(near(open, FORD, 1)).toBe(true);
  });

  it('opens the bridge deck only after the bridge is restored', () => {
    const bridge = SITE_ANCHORS.creek_bridge!;
    expect(sampleGround(level, bridge.x, bridge.z)).toBeNull();
    const deck = sampleGround(level, bridge.x, bridge.z, new Set(['creek_bridge']));
    expect(deck).not.toBeNull();
    const restored = reachable(level, new Set(['creek_bridge']));
    expect(near(restored, bridge, 0.6)).toBe(true);
  });

  it('keeps every footpath within the walking slope along its whole length', () => {
    for (const line of PATHS) for (let i = 0; i < line.length - 1; i++) {
      const a = line[i]!, b = line[i + 1]!, n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.25);
      for (let k = 0; k <= n; k++) {
        const x = a.x + (b.x - a.x) * k / n, z = a.z + (b.z - a.z) * k / n, h = groundHeight(x, z);
        for (const [dx, dz] of [[0.28, 0], [-0.28, 0], [0, 0.28], [0, -0.28]] as const) expect(Math.abs(groundHeight(x + dx, z + dz) - h), `${x.toFixed(1)},${z.toFixed(1)}`).toBeLessThanOrEqual(0.22);
      }
    }
  });

  it('grades every footpath gentler than the 38 degree walking limit when measured along the path', () => {
    for (const line of PATHS) for (let i = 0; i < line.length - 1; i++) {
      const a = line[i]!, b = line[i + 1]!, len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(len / 0.2);
      let prev = groundHeight(a.x, a.z);
      for (let k = 1; k <= n; k++) {
        const x = a.x + (b.x - a.x) * k / n, z = a.z + (b.z - a.z) * k / n, h = groundHeight(x, z);
        expect(Math.abs(h - prev) / (len / n), `${x.toFixed(1)},${z.toFixed(1)}`).toBeLessThan(Math.tan(33 * Math.PI / 180));
        prev = h;
      }
    }
  });

  it('leaves no too-steep terrain facet anywhere on a footpath walkway', () => {
    for (const line of PATHS) for (let i = 0; i < line.length - 1; i++) {
      const a = line[i]!, b = line[i + 1]!, len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(len / 0.1);
      const nx = -(b.z - a.z) / len, nz = (b.x - a.x) / len;
      for (let k = 0; k <= n; k++) for (const off of [-0.5, 0, 0.5]) {
        const x = a.x + (b.x - a.x) * k / n + nx * off, z = a.z + (b.z - a.z) * k / n + nz * off, g = sampleGround(level, x, z);
        if (g) expect(g.normal.y, `${x.toFixed(2)},${z.toFixed(2)}`).toBeGreaterThan(Math.cos(37.5 * Math.PI / 180));
      }
    }
  });

  it('places all eight sites where the World expects them', () => {
    const world = new World(level, REPAIR_SCENARIOS);
    for (const site of world.snapshot().sites) expect(site.position).toEqual(level.sitePositions![site.id]);
  });

  it('focuses the site the restorer is deepest into where two ranges overlap', () => {
    const sites = Object.entries(level.sitePositions!).map(([id, position]) => ({ id, position }));
    // Where a journey run stopped on the bridge approach: inside the pump's edge, well inside the bridge's reach.
    expect(focusSite(sites, { x: -6.64, z: 2.99 })).toBe('creek_bridge');
    // Beside the pump it stays the pump; far from everything nothing is in focus.
    expect(focusSite(sites, { x: -10.6, z: 4.4 })).toBe('village_pump');
    expect(focusSite(sites, { x: 22, z: 22 })).toBeNull();
  });

  it('migrates saves from the previous island to the new landing', () => {
    const world = new World(level, REPAIR_SCENARIOS), save = world.exportSave();
    world.restoreSave({ ...save, levelId: 'imported-google-island-v1', position: { x: 30, y: 2, z: 30 } });
    expect(world.snapshot().player.position).toEqual(level.spawn);
  });
});
