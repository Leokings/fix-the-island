import type { LevelData, Vec3, WalkTriangle } from '../domain/terrain';

// Small coast patch only: not the eight-site world or a final terrain asset.
const bounds = { minX: -52, maxX: -24, minZ: 32, maxZ: 56 };
const height = (x: number, z: number) => 2 + 0.14 * Math.sin((x + 38) * 0.2) * Math.cos((z - 44) * 0.18);
const vertex = (x: number, z: number): Vec3 => ({ x, y: height(x, z), z });
const triangles: WalkTriangle[] = [];
for (let x = bounds.minX; x < bounds.maxX; x += 2) {
  for (let z = bounds.minZ; z < bounds.maxZ; z += 2) {
    const a = vertex(x, z), b = vertex(x + 2, z), c = vertex(x, z + 2), d = vertex(x + 2, z + 2);
    triangles.push({ id: `coast-${x}-${z}-a`, a, b: c, c: b, biome: 'coast' }, { id: `coast-${x}-${z}-b`, a: b, b: c, c: d, biome: 'coast' });
  }
}
const trees = [[-46, 38], [-44, 35], [-48, 48], [-45, 51], [-30, 48], [-28, 43], [-30, 36], [-33, 34]]
  .map(([x, z]) => vertex(x!, z!));

export const SMOKE_LEVEL: LevelData = Object.freeze({
  id: 'stage-a-coast-smoke', spawn: Object.freeze({ x: -38, y: 2, z: 44 }), bounds: Object.freeze(bounds),
  triangles: Object.freeze(triangles), trees: Object.freeze(trees), visibleSiteIds: Object.freeze(['pier_hoist']),
  obstacles: Object.freeze([
    { id: 'pier_hoist', minX: -39.5, maxX: -36.5, minZ: 39, maxZ: 41 },
    ...trees.map((tree, i) => ({ id: `tree-${i}`, minX: tree.x - 0.14, maxX: tree.x + 0.14, minZ: tree.z - 0.14, maxZ: tree.z + 0.14 })),
  ]),
});
