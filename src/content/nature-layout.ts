import type { LevelData, Vec3 } from '../domain/terrain';

/** Physical placement result, not a restoration grant or a progress fraction. */
export interface PlantedTree {
  readonly position: Vec3;
  readonly requires: readonly string[];
}

/** Construct before World. Rendering and collision consume the same planting. */
export function withPlantedTrees(level: LevelData, planting: readonly PlantedTree[]): LevelData {
  const key = (x: number, z: number) => `${x.toFixed(6)},${z.toFixed(6)}`;
  const planted = new Map(planting.map(tree => [key(tree.position.x, tree.position.z), tree]));
  if (planted.size !== planting.length) throw new Error('Duplicate planted trunk');
  const matched = new Set<string>();
  const obstacles = level.obstacles.flatMap(obstacle => {
    if (!obstacle.id.startsWith('tree-')) return [obstacle];
    const location = key((obstacle.minX + obstacle.maxX) / 2, (obstacle.minZ + obstacle.maxZ) / 2);
    const tree = planted.get(location);
    if (!tree) return [];
    matched.add(location);
    return [{ ...obstacle, requires: tree.requires }];
  });
  if (matched.size !== planted.size) throw new Error('Planted trunk has no authored collision footprint');
  return Object.freeze({ ...level, obstacles: Object.freeze(obstacles),
    trees: Object.freeze(planting.map(tree => tree.position)) });
}
