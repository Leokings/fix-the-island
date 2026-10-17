/**
 * Scene-local island adapter of SmallWorld flora techniques, MIT.
 * Copyright (c) 2026 Paul Robello. Source 0416bbcf7dbc58b2782f13698c74ac1dde459613.
 * Retained excerpts are marked below. Full notice: public/licenses/small-world-MIT.txt.
 */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { sampleGround } from '../../domain/terrain';
import type { LevelData, Vec3, WalkTriangle } from '../../domain/terrain';
import type { PlantedTree } from '../../content/nature-layout';
import { INSPECT_CAMERA, WALK_CAMERA } from '../presets';
import { buildLeafGeo, makeBoughGeometry, makeGrassBladeGeometry, makePool, mulberry32, patchNatureWind } from './small-world-detail';
import type { NatureWind } from './small-world-detail';
import { createPBRFamily } from './surface-materials';
export { createIslandSurfaceMaterials } from './surface-materials';
export type { IslandSurfaceMaterials } from './surface-materials';

export interface IslandNature {
  group: THREE.Group;
  /** Fixed visible-trunk plan for World construction, before any gameplay. */
  readonly plantedTrees: readonly PlantedTree[];
  /** Seconds and caller-owned verified/practice restoration fraction 0..1. */
  update(time: number, restoration: number, restoredSiteIds?: ReadonlySet<string>): void;
  dispose(): void;
}
interface Instance { readonly matrix: THREE.Matrix4; readonly color: THREE.Color }
interface Batch {
  readonly geometry: THREE.BufferGeometry; readonly material: THREE.MeshStandardMaterial;
  readonly instances: Instance[]; readonly shadow: boolean; readonly wind?: 'leaf' | 'stem';
  readonly requires: readonly string[];
}

function distanceToSegment(x: number, z: number, a: Vec3, b: Vec3): number {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / Math.max(1e-12, dx * dx + dz * dz)));
  return Math.hypot(x - a.x - t * dx, z - a.z - t * dz);
}
function distanceToTriangle(x: number, z: number, t: WalkTriangle): number {
  const cross = (a: Vec3, b: Vec3) => (b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x);
  const a = cross(t.a, t.b), b = cross(t.b, t.c), c = cross(t.c, t.a);
  if ((a >= 0 && b >= 0 && c >= 0) || (a <= 0 && b <= 0 && c <= 0)) return 0;
  return Math.min(distanceToSegment(x, z, t.a, t.b), distanceToSegment(x, z, t.b, t.c), distanceToSegment(x, z, t.c, t.a));
}
const reservedSurface = (id: string) => /^(route:|join:|pad:|workshop-foundation:|bridge-|pier-apron$|landing$)/.test(id);
const colorAt = (z: number, shade: number, rusty: boolean) => new THREE.Color(
  rusty ? '#b17845' : z >= 18 ? '#8d9b52' : z > -24 ? '#66864f' : '#567d68').multiplyScalar(shade);

/**
 * Ground and clearance come only from LevelData. Unsupported slots are skipped.
 * Build after the final level is available, scene.add(nature.group), update each frame.
 * Remove the previous renderer's trees when integrating; this adapter does not do so.
 */
export async function createIslandNature(level: LevelData): Promise<IslandNature> {
  const group = new THREE.Group(); group.name = 'island-nature'; group.userData.category = 'foliage';
  const geometryPool = makePool<THREE.BufferGeometry>(), shadowPool = makePool<THREE.Material>();
  const wood = createPBRFamily('wood', '#795b3e'), stone = createPBRFamily('stone', '#b3b5a6');
  const leaf = createPBRFamily('leaf', '#ffffff');
  const evergreen = leaf.material.clone(); evergreen.name = 'island-nature-evergreen'; evergreen.vertexColors = true;
  const grass = leaf.material.clone(); grass.name = 'island-nature-grass';
  const reed = leaf.material.clone(); reed.name = 'island-nature-reed';
  const wind: NatureWind = { time: { value: 0 }, strength: { value: 0.85 } };
  patchNatureWind(leaf.material, wind, 'leaf', 0.65);
  patchNatureWind(grass, wind, 'stem', 0.65); patchNatureWind(reed, wind, 'stem', 0.18);
  // Bough skirts stay fixed; fine leaf/grass/reed motion carries restrained wind.
  const meshes: THREE.InstancedMesh[] = [], batches = new Map<string, Batch>();
  const plantedTrees: PlantedTree[] = [];
  // All-requirements sampling is placement-only. The adapter never passes this
  // set to gameplay/collision or exposes it as approved state. Actual readiness
  // controls mesh visibility in update using only the caller's supplied IDs.
  const physicalRequirements = new Set(level.triangles.flatMap(t => [...(t.requires ?? [])]));
  const noRestoredSites: ReadonlySet<string> = new Set();
  const requirementsBySurface = new Map<string, Set<string>>();
  for (const triangle of level.triangles) {
    let required = requirementsBySurface.get(triangle.id);
    if (!required) { required = new Set(); requirementsBySurface.set(triangle.id, required); }
    for (const id of triangle.requires ?? []) required.add(id);
  }
  const unionRequirements = (...lists: readonly (readonly string[])[]) => [...new Set(lists.flat())].sort();
  let activeRequirements: readonly string[] = [];
  let seed = 2166136261;
  for (const ch of level.id) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  const rng = mulberry32(seed >>> 0), up = new THREE.Vector3(0, 1, 0);
  const reserved = level.triangles.filter(t => reservedSurface(t.id)).map(t => ({ t,
    minX: Math.min(t.a.x, t.b.x, t.c.x), maxX: Math.max(t.a.x, t.b.x, t.c.x),
    minZ: Math.min(t.a.z, t.b.z, t.c.z), maxZ: Math.max(t.a.z, t.b.z, t.c.z) }));
  const obstacles = level.obstacles.filter(o => !/^tree-/.test(o.id));
  const stats = { requestedTrees: level.trees.length, plantedTrees: 0, skippedUnsupported: 0,
    skippedClearance: 0, grassBlades: 0, shrubs: 0, reeds: 0, rocks: 0, instances: 0, batches: 0, triangles: 0 };

  function clear(x: number, z: number, radius: number): boolean {
    if (Math.hypot(x - level.spawn.x, z - level.spawn.z) < radius + 1.0) return false;
    if (level.gates?.some(g => Math.hypot(x - g.position.x, z - g.position.z) < radius + 1.4)) return false;
    for (const o of obstacles) if (x + radius > o.minX - 0.35 && x - radius < o.maxX + 0.35 &&
      z + radius > o.minZ - 0.35 && z - radius < o.maxZ + 0.35) return false;
    for (const r of reserved) if (x + radius >= r.minX && x - radius <= r.maxX && z + radius >= r.minZ &&
      z - radius <= r.maxZ && distanceToTriangle(x, z, r.t) < radius + 0.25) return false;
    return true;
  }
  function supported(x: number, z: number, radius: number) {
    if (x - radius < level.bounds.minX || x + radius > level.bounds.maxX ||
      z - radius < level.bounds.minZ || z + radius > level.bounds.maxZ) return null;
    const centre = sampleGround(level, x, z, physicalRequirements);
    if (!centre || centre.y <= 0.12 || centre.normal.y < 0.8 || reservedSurface(centre.surfaceId)) return null;
    const required = new Set(requirementsBySurface.get(centre.surfaceId) ?? []);
    // Entire prop foot stays on the actual underlying surface. Requirements
    // are collected for visibility; sampling them is never game authorization.
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const sample = sampleGround(level, x + Math.cos(angle) * radius, z + Math.sin(angle) * radius, physicalRequirements);
      if (!sample || sample.y <= 0.12 || reservedSurface(sample.surfaceId) || sample.normal.y < 0.8 ||
        Math.abs(sample.y - centre.y) > radius * 0.65 + 0.04) return null;
      for (const id of requirementsBySurface.get(sample.surfaceId) ?? []) required.add(id);
    }
    return { ...centre, requires: [...required].sort() };
  }
  function bankDistance(x: number, z: number): number {
    let closest = Infinity;
    for (const [a, b] of level.banks ?? []) closest = Math.min(closest, distanceToSegment(x, z, a, b));
    return closest;
  }
  const trunkGeo = geometryPool.get('trunk', () => {
    // src/flora/trees.js leafballtree trunk bend, taperTwist and ring shading.
    // Base diameter remains within the existing tree obstacle footprint.
    const geo = new THREE.CylinderGeometry(0.095, 0.16, 2.05, 9, 6).translate(0, 1.025, 0);
    const pos = geo.attributes.position!, colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const t = pos.getY(i) / 2.05;
      pos.setX(i, pos.getX(i) + Math.sin(t * Math.PI) * 0.07);
      pos.setZ(i, pos.getZ(i) + Math.sin(t * Math.PI * 2.2) * 0.026);
      // Bark-ring shading: horizontal bands with soft edges.
      const ring = 0.5 + 0.5 * Math.sin(t * 7 * Math.PI * 2), band = 0.82 + ring * 0.18;
      const noise = 0.96 + Math.sin(pos.getX(i) * 13.7 + pos.getZ(i) * 9.3) * 0.04;
      colors.set([band * noise, band * noise, band * noise], i * 3);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals(); return geo;
  });
  wood.material.vertexColors = true;
  const branchGeo = geometryPool.get('branch', () => new THREE.CylinderGeometry(0.025, 0.065, 1, 6));
  const leafGeo = geometryPool.get('leaf', () => buildLeafGeo());
  const boughGeo = geometryPool.get('bough', () => makeBoughGeometry());
  const grassGeo = geometryPool.get('grass', () => {
    const a = makeGrassBladeGeometry(), b = a.clone().rotateY(Math.PI / 2);
    const merged = mergeGeometries([a, b]); a.dispose(); b.dispose();
    if (!merged) throw new Error('Nature crossed grass geometry merge failed'); return merged;
  });
  const reedGeo = geometryPool.get('reed', () => {
    // Crossed curved blades retain the upstream taper, with a taller rooted silhouette.
    const g = grassGeo.clone(); const p = g.attributes.position!;
    for (let i = 0; i < p.count; i++) { const h = p.getY(i) / 0.34;
      p.setXYZ(i, p.getX(i) * 0.65 + h * h * 0.12, p.getY(i) * 3.0, p.getZ(i) * 0.65); }
    g.computeVertexNormals(); return g;
  });
  const rockGeo = geometryPool.get('rock', () => {
    // src/util.js jitterGeo: weld positions before seeded perturbation, reconstruct UVs.
    const source = new THREE.IcosahedronGeometry(1, 1); source.deleteAttribute('uv'); source.deleteAttribute('normal');
    const welded = mergeVertices(source, 1e-4); source.dispose();
    const p = welded.attributes.position!, uv = new Float32Array(p.count * 2), vertex = new THREE.Vector3();
    const random = mulberry32(903);
    for (let i = 0; i < p.count; i++) {
      p.setXYZ(i, p.getX(i) + (random() - 0.5) * 0.22, p.getY(i) + (random() - 0.5) * 0.18,
        p.getZ(i) + (random() - 0.5) * 0.22);
      vertex.fromBufferAttribute(p, i).normalize();
      uv[i * 2] = 0.5 + Math.atan2(vertex.z, vertex.x) / (Math.PI * 2);
      uv[i * 2 + 1] = 0.5 - Math.asin(Math.max(-1, Math.min(1, vertex.y))) / Math.PI;
    }
    welded.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); welded.computeVertexNormals(); return welded;
  });

  function add(kind: string, geometry: THREE.BufferGeometry, material: THREE.MeshStandardMaterial,
    position: THREE.Vector3, quaternion: THREE.Quaternion, scale: THREE.Vector3, color: THREE.Color,
    shadow = true, mode?: 'leaf' | 'stem', requires: readonly string[] = activeRequirements): void {
    // 16m scene chunks permit ordinary Three frustum culling on nearby clusters.
    const key = `${Math.floor(position.x / 16)},${Math.floor(position.z / 16)}:${kind}:${JSON.stringify(requires)}`;
    let batch = batches.get(key);
    if (!batch) { batch = { geometry, material, instances: [], shadow, requires: Object.freeze([...requires]),
      ...(mode ? { wind: mode } : {}) }; batches.set(key, batch); }
    batch.instances.push({ matrix: new THREE.Matrix4().compose(position, quaternion, scale), color: color.clone() });
  }
  function branch(start: THREE.Vector3, end: THREE.Vector3, tint: THREE.Color) {
    const delta = end.clone().sub(start);
    add('branch', branchGeo, wood.material, start.clone().add(end).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(up, delta.clone().normalize()), new THREE.Vector3(1, delta.length(), 1), tint);
  }
  function crown(centre: THREE.Vector3, radius: THREE.Vector3, tintZ: number, rusty: boolean, size = 1) {
    // src/flora/trees.js leafballtree.orientLeaf/addLeafRing. Reduced rows,
    // no outline double-draw, typed scene batches rather than per-tree meshes.
    const rowCounts = [9, 14, 18, 22, 20, 17, 10], basis = new THREE.Matrix4();
    for (let row = 0; row < rowCounts.length; row++) {
      const t = row / (rowCounts.length - 1), phi = 0.18 + t * 2.50;
      const count = rowCounts[row]!, phase = row * 0.41;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + phase + (rng() - 0.5) * 0.04;
        const normal = new THREE.Vector3(Math.sin(phi) * Math.cos(a), Math.cos(phi), Math.sin(phi) * Math.sin(a)).normalize();
        const leafObject = new THREE.Object3D();
        leafObject.position.set(centre.x + normal.x * radius.x, centre.y + normal.y * radius.y, centre.z + normal.z * radius.z);
        const tangentDown = up.clone().sub(normal.clone().multiplyScalar(up.dot(normal)));
        if (tangentDown.lengthSq() < 0.0001) tangentDown.set(0, 0, 1);
        tangentDown.normalize().multiplyScalar(-1);
        // Point each teardrop down the dome, then tip its face slightly outward.
        // That shingle lift gives rows visible overlap without leaf planes
        // slicing through each other like a flat shell.
        const faceNormal = normal.clone().addScaledVector(tangentDown, 0.22 - t * 0.10).normalize();
        // ShapeGeometry leaf tip is local -Y; map local -Y to tangentDown so
        // upper leaves point down over lower leaves, not underneath them.
        const yAxis = tangentDown.clone().multiplyScalar(-1), xAxis = yAxis.clone().cross(faceNormal).normalize();
        basis.makeBasis(xAxis, yAxis, faceNormal); leafObject.quaternion.setFromRotationMatrix(basis);
        leafObject.rotateX(0.04); leafObject.rotateZ((rng() - 0.5) * 0.08);
        const s = size * (0.92 + rng() * 0.16);
        add('leaf', leafGeo, leaf.material, leafObject.position, leafObject.quaternion, new THREE.Vector3(s * 1.15, s * 1.4, s),
          colorAt(tintZ, row < 2 ? 1.13 : row > 4 ? 0.72 : 0.93, rusty), true, 'leaf');
      }
    }
  }

  for (const slot of level.trees) {
    const foot = supported(slot.x, slot.z, 0.20);
    if (!foot) { stats.skippedUnsupported++; continue; }
    const isEvergreen = slot.z < -24 || (slot.z < 18 && rng() < 0.25);
    const crownRadius = isEvergreen ? 1.08 : 1.28;
    const h = 0.95 + rng() * 0.24;
    // At the two existing orthographic angles, elevated crowns project behind
    // their roots onto the ground. Reserve that projection over paths/work pads
    // too, so a foreground tree cannot conceal the hero or working assembly.
    const clearProjection = [WALK_CAMERA, INSPECT_CAMERA].every(camera => {
      const yaw = THREE.MathUtils.degToRad(camera.yawDegrees), pitch = THREE.MathUtils.degToRad(camera.pitchDegrees);
      return [1.8, 2.8, 3.8, 4.5].every(height => {
        const reach = height * h / Math.tan(pitch);
        return clear(slot.x - Math.sin(yaw) * reach, slot.z - Math.cos(yaw) * reach, crownRadius + 0.3);
      });
    });
    if (!clear(slot.x, slot.z, crownRadius + 0.3) || !clearProjection) { stats.skippedClearance++; continue; }
    stats.plantedTrees++;
    activeRequirements = foot.requires;
    const base = new THREE.Vector3(slot.x, foot.y, slot.z);
    plantedTrees.push(Object.freeze({position:Object.freeze({x:slot.x,y:foot.y,z:slot.z}),requires:Object.freeze([...foot.requires])}));
    const yaw = rng() * Math.PI * 2, rotation = new THREE.Quaternion().setFromAxisAngle(up, yaw);
    add('trunk', trunkGeo, wood.material, base, rotation, new THREE.Vector3(1, h, 1), new THREE.Color('#ffffff'));
    if (isEvergreen) {
      for (let tier = 0; tier < 5; tier++) {
        const radius = 0.95 - tier * 0.14;
        add('bough', boughGeo, evergreen, base.clone().add(new THREE.Vector3(0, (1.25 + tier * 0.58) * h, 0)),
          new THREE.Quaternion().setFromAxisAngle(up, yaw + tier * 0.44), new THREE.Vector3(radius, h * 1.10, radius),
          colorAt(slot.z, 0.92 + tier * 0.035, false));
      }
    } else {
      const rusty = slot.z >= 18 && rng() < 0.24;
      crown(base.clone().add(new THREE.Vector3(0.06, 2.65 * h, 0)), new THREE.Vector3(1.02, 0.86 * h, 1.02), slot.z, rusty, 1.34);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.24 + yaw;
        branch(base.clone().add(new THREE.Vector3(0.03 * Math.cos(a), (1.65 + i * 0.025) * h, 0.03 * Math.sin(a))),
          base.clone().add(new THREE.Vector3(Math.cos(a) * 0.74, (2.34 + (i % 2) * 0.10) * h, Math.sin(a) * 0.74)), new THREE.Color('#ffffff'));
      }
    }
    // Supporting nature stays in the same tree neighbourhood, with independent
    // footprint support/clearance for every tuft/shrub/stone. No island-wide scatter.
    for (let j = 0; j < 12; j++) {
      const angle = rng() * Math.PI * 2, distance = 0.45 + rng() * 1.5;
      const x = slot.x + Math.cos(angle) * distance, z = slot.z + Math.sin(angle) * distance;
      if (!clear(x, z, 0.40)) continue;
      const support = supported(x, z, 0.32); if (!support) continue;
      activeRequirements = unionRequirements(foot.requires, support.requires);
      const position = new THREE.Vector3(x, support.y, z), orient = new THREE.Quaternion().setFromAxisAngle(up, rng() * Math.PI * 2);
      if (j === 0) {
        const r = 0.21 + rng() * 0.06;
        add('rock', rockGeo, stone.material, position.clone().add(new THREE.Vector3(0, 0.06, 0)), orient,
          new THREE.Vector3(r, 0.14, r * 0.8), new THREE.Color(slot.z < -24 ? '#c1c5d0' : '#d3cbb3')); stats.rocks++;
      } else if (j === 1) {
        crown(position.clone().add(new THREE.Vector3(0, 0.32, 0)), new THREE.Vector3(0.28, 0.23, 0.28), z, false, 0.45); stats.shrubs++;
      } else {
        const isReed = z >= 18 && bankDistance(x, z) < 1.6;
        for (let blade = 0; blade < (isReed ? 4 : 6); blade++) {
          const bx = x + (rng() - 0.5) * 0.35, bz = z + (rng() - 0.5) * 0.35;
          const bfoot = supported(bx, bz, 0.09); if (!bfoot || !clear(bx, bz, 0.13)) continue;
          const scale = 0.8 + rng() * 0.55;
          add(isReed ? 'reed' : 'grass', isReed ? reedGeo : grassGeo, isReed ? reed : grass,
            new THREE.Vector3(bx, bfoot.y, bz), new THREE.Quaternion().setFromAxisAngle(up, rng() * Math.PI * 2),
            new THREE.Vector3(scale, scale, scale), colorAt(z, 0.95 + rng() * 0.25, false), false, 'stem',
            unionRequirements(activeRequirements, bfoot.requires));
          if (isReed) stats.reeds++; else stats.grassBlades++;
        }
      }
    }
  }

  for (const [key, batch] of batches) {
    const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.instances.length);
    mesh.name = key; mesh.userData.category = 'foliage'; mesh.userData.natureKind = key.split(':')[1];
    mesh.userData.requiredSiteIds = batch.requires; mesh.visible = batch.requires.length === 0;
    batch.instances.forEach((instance, i) => { mesh.setMatrixAt(i, instance.matrix); mesh.setColorAt(i, instance.color); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = batch.shadow; mesh.receiveShadow = true;
    if (batch.wind && batch.shadow) {
      const mode = batch.wind, strength = mode === 'leaf' ? 0.65 : 0.18;
      mesh.customDepthMaterial = shadowPool.get(`${mode}:depth`, () => {
        const mat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
        patchNatureWind(mat, wind, mode, strength); return mat;
      });
      mesh.customDistanceMaterial = shadowPool.get(`${mode}:distance`, () => {
        const mat = new THREE.MeshDistanceMaterial({ side: THREE.DoubleSide }); patchNatureWind(mat, wind, mode, strength); return mat;
      });
    }
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    // Include the small shader-only flutter displacement in the culling volume.
    if (mesh.boundingBox) mesh.boundingBox.expandByScalar(0.12);
    if (mesh.boundingSphere) mesh.boundingSphere.radius += 0.12;
    group.add(mesh); meshes.push(mesh);
    stats.instances += mesh.count;
    stats.triangles += mesh.count * (batch.geometry.index?.count ?? batch.geometry.attributes.position!.count) / 3;
  }
  stats.batches = meshes.length; group.userData.natureStats = Object.freeze(stats);
  group.userData.visibleNatureBatches = meshes.filter(mesh => mesh.visible).length;
  group.userData.source = 'SmallWorld MIT / 0416bbcf7dbc58b2782f13698c74ac1dde459613';
  let disposed = false;
  return { group, plantedTrees:Object.freeze(plantedTrees),
    update(time, restoration, restoredSiteIds = noRestoredSites) {
      if (disposed) return;
      wind.time.value = Number.isFinite(time) ? time : 0;
      const amount = Number.isFinite(restoration) ? Math.max(0, Math.min(1, restoration)) : 0;
      // The storm gradually calms. The caller owns verified/practice progress;
      // this aesthetic input never creates a restoration grant or route change.
      wind.strength.value = 0.85 - amount * 0.35;
      let visible = 0;
      for (const mesh of meshes) {
        const required = mesh.userData.requiredSiteIds as readonly string[];
        mesh.visible = required.every(id => restoredSiteIds.has(id));
        if (mesh.visible) visible++;
      }
      group.userData.visibleNatureBatches = visible;
    },
    dispose() {
      if (disposed) return; disposed = true; group.removeFromParent(); group.clear();
      for (const mesh of meshes) mesh.dispose(); meshes.length = 0; batches.clear();
      geometryPool.dispose(); shadowPool.dispose(); evergreen.dispose(); grass.dispose(); reed.dispose();
      wood.dispose(); stone.dispose(); leaf.dispose();
    } };
}
