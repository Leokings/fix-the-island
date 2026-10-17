import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import workbenchUrl from '../../../assets/props/kenney-survival/workbench.glb?url';
import barrelUrl from '../../../assets/props/kenney-survival/barrel.glb?url';
import planksUrl from '../../../assets/props/kenney-survival/resource-planks.glb?url';
import signpostUrl from '../../../assets/props/kenney-survival/signpost.glb?url';
import hammerUrl from '../../../assets/props/kenney-survival/tool-hammer.glb?url';
import tentUrl from '../../../assets/props/kenney-survival/tent-canvas.glb?url';
import canopyUrl from '../../../assets/props/kenney-survival/structure-canvas.glb?url';
import fenceUrl from '../../../assets/props/kenney-survival/fence.glb?url';
import boxUrl from '../../../assets/props/kenney-survival/box.glb?url';
import largeBoxUrl from '../../../assets/props/kenney-survival/box-large.glb?url';
import grassUrl from '../../../assets/props/kenney-survival/grass-large.glb?url';
import grassPatchUrl from '../../../assets/props/kenney-survival/patch-grass-large.glb?url';
import smallLogUrl from '../../../assets/props/kenney-survival/tree-log-small.glb?url';
import survivalPaletteUrl from '../../../assets/props/kenney-survival/Textures/colormap.png?url';
import machineUrl from '../../../assets/props/kenney-factory/machine.glb?url';
import valveUrl from '../../../assets/props/kenney-factory/pipe-large-valve.glb?url';
import curveUrl from '../../../assets/props/kenney-factory/pipe-large-curve.glb?url';
import longPipeUrl from '../../../assets/props/kenney-factory/pipe-large-long.glb?url';
import leverUrl from '../../../assets/props/kenney-factory/lever-single.glb?url';
import pistonUrl from '../../../assets/props/kenney-factory/piston-round.glb?url';
import hopperUrl from '../../../assets/props/kenney-factory/hopper-round.glb?url';
import factoryPaletteUrl from '../../../assets/props/kenney-factory/Textures/colormap.png?url';

// Unmodified Kenney CC0 sources; measured dimensions and notices: docs/PROP-PROVENANCE.md.
const definitions = {
  workbench: { pack: 'survival', url: workbenchUrl, scale: 4 },
  barrel: { pack: 'survival', url: barrelUrl, scale: 2.5 },
  'resource-planks': { pack: 'survival', url: planksUrl, scale: 2 },
  signpost: { pack: 'survival', url: signpostUrl, scale: 3.5 },
  'tool-hammer': { pack: 'survival', url: hammerUrl, scale: 2.5 },
  'tent-canvas': { pack: 'survival', url: tentUrl, scale: 5 },
  'structure-canvas': { pack: 'survival', url: canopyUrl, scale: 5.2 },
  fence: { pack: 'survival', url: fenceUrl, scale: 2 },
  box: { pack: 'survival', url: boxUrl, scale: 2.4 },
  'box-large': { pack: 'survival', url: largeBoxUrl, scale: 2.4 },
  'grass-large': { pack: 'survival', url: grassUrl, scale: 2.2 },
  'patch-grass-large': { pack: 'survival', url: grassPatchUrl, scale: 1.8 },
  'tree-log-small': { pack: 'survival', url: smallLogUrl, scale: 2.5 },
  machine: { pack: 'factory', url: machineUrl, scale: 1 },
  'pipe-large-valve': { pack: 'factory', url: valveUrl, scale: 1 },
  'pipe-large-curve': { pack: 'factory', url: curveUrl, scale: 1 },
  'pipe-large-long': { pack: 'factory', url: longPipeUrl, scale: 1 },
  'lever-single': { pack: 'factory', url: leverUrl, scale: 1 },
  'piston-round': { pack: 'factory', url: pistonUrl, scale: 1 },
  'hopper-round': { pack: 'factory', url: hopperUrl, scale: 1 },
} as const;

export const REPAIR_PROP_SOURCES=definitions;
export type RepairPropKind = keyof typeof definitions;

export interface RepairPropLibrary {
  /** Detached prop in metres; fresh materials and root.animations for this instance. */
  create(kind: RepairPropKind): THREE.Group;
  /** Detach and release an instance's owned materials. Shared geometry/maps remain alive. */
  release(prop: THREE.Group): void;
  /** Invalidate/detach all instances and release all library-owned resources, once. */
  dispose(): void;
}

/** Loads ordinary supporting props only. No placement, mixer, collision, or game authority. */
export async function loadRepairPropLibrary(): Promise<RepairPropLibrary> {
  const failedUrls = new Set<string>();
  function packLoader(paletteUrl: string): GLTFLoader {
    const manager = new THREE.LoadingManager();
    // Vite treats GLB bytes as opaque: relative image URIs are not rewritten by the build.
    // Each pack has its own resolver so identically named source palettes never collide.
    manager.setURLModifier(url =>
      url.replace(/\\/g, '/').endsWith('Textures/colormap.png') ? paletteUrl : url,
    );
    // HTMLImage lifetime follows the shared textures; avoid ImageBitmap.close ownership
    // conflicts if another library or the caller enables Three's global image cache.
    manager.addHandler(/Textures\/colormap\.png$/, new THREE.TextureLoader(manager));
    manager.onError = url => { failedUrls.add(url); };
    return new GLTFLoader(manager);
  }

  const loaders = { survival: packLoader(survivalPaletteUrl), factory: packLoader(factoryPaletteUrl) };
  const kinds = Object.keys(definitions) as RepairPropKind[];
  // Wait for every request, including on failure, before releasing shared resources.
  const results = await Promise.allSettled(kinds.map(kind => {
    const definition = definitions[kind];
    return loaders[definition.pack].loadAsync(definition.url);
  }));
  const sources = new Map<RepairPropKind, GLTF>();
  const geometries = new Set<THREE.BufferGeometry>();
  const sourceMaterials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const failures: unknown[] = [];

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      failures.push(result.reason);
      return;
    }
    sources.set(kinds[index]!, result.value);
    result.value.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        sourceMaterials.add(material);
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) textures.add(value);
        }
        // GLTFLoader can otherwise resolve successfully after an image-loading failure.
        if (material instanceof THREE.MeshStandardMaterial && !material.map) {
          failures.push(new Error(`Missing palette for repair prop ${kinds[index]}`));
        }
      }
    });
  });

  function disposeSources(): void {
    for (const geometry of geometries) geometry.dispose();
    for (const material of sourceMaterials) material.dispose();
    for (const texture of textures) texture.dispose();
    geometries.clear();
    sourceMaterials.clear();
    textures.clear();
    sources.clear();
  }

  if (failures.length || failedUrls.size) {
    disposeSources();
    throw new AggregateError(
      [...failures, ...Array.from(failedUrls, url => new Error(`Asset load failed: ${url}`))],
      'Could not load the complete repair prop library',
    );
  }

  let disposed = false;
  const instances = new Map<THREE.Group, Set<THREE.Material>>();

  function release(prop: THREE.Group): void {
    const materials = instances.get(prop);
    if (!materials) return;
    prop.removeFromParent();
    prop.clear();
    prop.animations = [];
    for (const material of materials) material.dispose();
    instances.delete(prop);
  }

  return {
    create(kind) {
      if (disposed) throw new Error('Repair prop library has been disposed');
      const source = sources.get(kind);
      if (!source) throw new Error(`Unknown repair prop kind: ${kind}`);
      // All selected files are unskinned. Preserve authored names/pivots and child transforms.
      const model = source.scene.clone(true);
      const root = new THREE.Group();
      root.name = `repair-prop:${kind}`;
      root.userData.repairPropKind = kind;
      // Scale the wrapper, never animated children: glTF translation tracks stay in source units.
      root.scale.setScalar(definitions[kind].scale);
      root.add(model);
      root.animations = source.animations.map(clip => clip.clone());
      // Object3D.clone shares clips by default. Keep every node's public animation list private.
      model.traverse(object => {
        object.animations = object.animations.map(clip => clip.clone());
      });
      const materialCopies = new Map<THREE.Material, THREE.Material>();
      function copyMaterial(material: THREE.Material): THREE.Material {
        let copy = materialCopies.get(material);
        if (!copy) {
          copy = material.clone();
          materialCopies.set(material, copy);
        }
        return copy;
      }
      model.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        object.material = Array.isArray(object.material)
          ? object.material.map(copyMaterial) : copyMaterial(object.material);
      });
      instances.set(root, new Set(materialCopies.values()));
      return root;
    },
    release,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const prop of instances.keys()) release(prop);
      disposeSources();
    },
  };
}
