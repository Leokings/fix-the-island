import { describe, expect, it } from 'vitest';
import { REPAIR_SCENARIOS } from '../../src/genlayer';
import { SITE_PLAN, consumeSiteCatalog } from '../../src/content/site-plan';
import { SMOKE_LEVEL } from '../../src/content/smoke-level';
import { FIXED_SECONDS, FixedTick } from '../../src/domain/fixed-tick';
import { hitsObstacle, sampleGround, traverse } from '../../src/domain/terrain';
import { cameraRelativeMove, World } from '../../src/domain/world';
import { repairRegions } from '../../src/render/layout';

describe('Stage A domain boundaries', () => {
  it('normalizes diagonal movement in the fixed camera basis', () => {
    const forward = cameraRelativeMove(0, 1);
    expect(forward.x).toBeCloseTo(-Math.sin(35 * Math.PI / 180));
    expect(forward.z).toBeCloseTo(-Math.cos(35 * Math.PI / 180));
    expect(Math.hypot(...Object.values(cameraRelativeMove(1, 1)))).toBeCloseTo(1);
  });
  it('caps a long frame at four fixed steps and discards catch-up debt', () => {
    const clock = new FixedTick(); const calls: number[] = [];
    const result = clock.advance(1, (dt) => calls.push(dt));
    expect(calls).toEqual(Array(4).fill(FIXED_SECONDS));
    expect(result.steps).toBe(4); expect(result.alpha).toBeLessThan(1);
    expect(clock.droppedSeconds).toBeGreaterThan(0.9);
    expect(clock.advance(0, () => { throw new Error('Debt must not leak to the next frame'); }).steps).toBe(0);
  });
  it('uses the terrain mesh for height and rejects the off-land footprint', () => {
    expect(sampleGround(SMOKE_LEVEL, -38, 44)?.y).toBeCloseTo(2);
    expect(sampleGround(SMOKE_LEVEL, 100, 100)).toBeNull();
    expect(traverse(SMOKE_LEVEL, SMOKE_LEVEL.spawn, 0, 40).position).toEqual(SMOKE_LEVEL.spawn);
  });
  it('detects a swept crossing rather than only testing its destination', () => {
    const obstacle = SMOKE_LEVEL.obstacles[0]!;
    const from = { x: -44, y: 2, z: 40 }, to = { x: -32, y: 2, z: 40 };
    expect(hitsObstacle(from, to, obstacle)).toBe(true);
    expect(traverse(SMOKE_LEVEL, from, 12, 0).position.x).toBe(from.x);
  });
  it('leaves snapshots immutable while the authoritative player moves', () => {
    const world = new World(SMOKE_LEVEL, REPAIR_SCENARIOS); const previous = world.snapshot();
    for (let i = 0; i < 30; i++) world.tick(FIXED_SECONDS, [{ kind: 'Move', right: 1, up: 0, brisk: false }]);
    expect(world.snapshot().player.position.x).toBeGreaterThan(previous.player.position.x);
    expect(previous.player.position).toEqual(SMOKE_LEVEL.spawn);
    expect(Object.isFrozen(previous.player.position)).toBe(true);
    expect(() => JSON.stringify(previous)).not.toThrow();
  });
  it('retains asynchronous status while paused and never restores in smoke', () => {
    const world = new World(SMOKE_LEVEL, REPAIR_SCENARIOS);
    world.tick(FIXED_SECONDS, [{ kind: 'Pause' }]); world.enqueueReview({ status: 'disconnected' });
    world.tick(FIXED_SECONDS, []);
    expect(world.snapshot().reviewStatus).toBe('disabled');
    world.tick(FIXED_SECONDS, [{ kind: 'Pause' }]);
    expect(world.snapshot().reviewStatus).toBe('disconnected');
    expect(world.snapshot().sites.every((site) => site.phase === 'damaged')).toBe(true);
  });
  it('consumes all eight backend fixtures and disables a dependency mismatch', () => {
    expect(REPAIR_SCENARIOS.map((site) => site.id)).toEqual(SITE_PLAN.map((site) => site.id));
    expect(consumeSiteCatalog(REPAIR_SCENARIOS).every((site) => site.fixture !== null)).toBe(true);
    const changed = REPAIR_SCENARIOS.map((site, index) => index === 0 ? { ...site, requires: ['ridge_beacon'] } : site);
    expect(consumeSiteCatalog(changed)[0]?.fixture).toBeNull();
    expect(consumeSiteCatalog([]).every((site) => site.fixture === null)).toBe(true);
  });
});

describe('revision 2 protected layout regions', () => {
  for (const [width, height] of [[1920, 1080], [844, 390], [667, 375]] as const) {
    it(`keeps the live inset and dock outside the protected scene at ${width}×${height}`, () => {
      const { inset, dock, scene, drawer } = repairRegions(width, height);
      const overlaps = (a: typeof scene, b: typeof scene) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
      for (const region of [inset, dock, drawer]) {
        expect(region.x + region.width).toBeLessThanOrEqual(width);
        expect(region.y + region.height).toBeLessThanOrEqual(height);
        expect(overlaps(region, scene)).toBe(false);
      }
    });
  }
});
