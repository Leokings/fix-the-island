/**
 * PBR formula adaptations from SmallWorld src/pbr.js, MIT.
 * Copyright (c) 2026 Paul Robello. Revision 0416bbcf7dbc58b2782f13698c74ac1dde459613.
 * Full notice: public/licenses/small-world-MIT.txt; docs/NATURE-PROVENANCE.md.
 */
import * as THREE from 'three';

type Family = 'ground' | 'wood' | 'timber' | 'stone' | 'water' | 'leaf';
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

// Original hashNoise / smoothHashNoise bodies retained from src/pbr.js.
function hashNoise(x: number, z: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + z * 78.233 + seed * 0.071) * 43758.5453;
  return n - Math.floor(n);
}
function smoothHashNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hashNoise(ix, iz, seed), b = hashNoise(ix + 1, iz, seed);
  const c = hashNoise(ix, iz + 1, seed), d = hashNoise(ix + 1, iz + 1, seed);
  return (a + (b - a) * sx) + (c + (d - c) * sx - (a + (b - a) * sx)) * sz;
}
// src/pbr.js rockDetailHeight; original warp/crack/pore formula retained.
function rockDetailHeight(u: number, v: number, seed: number): number {
  const warpA = smoothHashNoise(u * 3.4, v * 3.1, seed + 1421) - 0.5;
  const warpB = smoothHashNoise(u * 4.7, v * 4.2, seed + 1453) - 0.5;
  const wu = u + warpA * 0.08, wv = v + warpB * 0.08;
  const broadMottle = smoothHashNoise(wu * 5.8, wv * 5.1, seed + 1481);
  const fineMottle = smoothHashNoise(wu * 17.0, wv * 15.0, seed + 1499);
  const poreNoise = smoothHashNoise(wu * 36.0, wv * 34.0, seed + 1511);
  const crackField = smoothHashNoise(wu * 4.6 + fineMottle * 0.52, wv * 4.1 - broadMottle * 0.45, seed + 1531);
  const crackMask = smoothHashNoise(wu * 8.3, wv * 7.7, seed + 1543);
  const irregularCracks = Math.max(0, 1 - Math.abs(crackField - 0.52) * 25) * Math.max(0, crackMask - 0.47);
  const pittedGrain = Math.max(0, 0.60 - poreNoise) * 0.58;
  const baseHeight = (broadMottle - 0.5) * 0.36 + (fineMottle - 0.5) * 0.18;
  return (baseHeight - pittedGrain - irregularCracks * 0.72) * 1.55;
}
// src/pbr.js detailNoise; used only as a texture, never as island elevation.
function detailNoise(x: number, z: number, seed: number): number {
  return Math.sin(x * 1.7 + seed * 0.013) * 0.38 + Math.sin(z * 2.1 - seed * 0.019) * 0.28 +
    Math.sin((x + z) * 3.6 + seed * 0.031) * 0.19 +
    (hashNoise(Math.floor(x * 2.4), Math.floor(z * 2.4), seed) - 0.5) * 0.30;
}

function field(family: Family, u: number, v: number): number {
  const seed = 1731;
  if(family==='timber') {
    // Local sawn-board response; bark remains the separate tree family.
    const bend=Math.sin(v*Math.PI*2)*.08;
    return Math.sin((u+bend)*Math.PI*24)*.016+Math.sin((u+bend*.6)*Math.PI*54+v*3)*.006+
      (smoothHashNoise(u*12,v*3,seed+719)-.5)*.012;
  }
  if (family === 'wood') {
    // buildLeafballBarkTextures: exact grain/ridge expressions; fixed local seed.
    const fineBarkGrain = Math.sin(u * Math.PI * 92 + v * 17.0) * 0.18 +
      Math.sin(u * Math.PI * 137 - v * 23.0) * 0.10 +
      (hashNoise(u * 256, v * 384, seed + 719) - 0.5) * 0.20;
    const barkRidge = Math.sin(u * Math.PI * 26 + Math.sin(v * Math.PI * 12) * 0.65) * 0.46 +
      Math.sin(u * Math.PI * 61 + v * 9.0) * 0.24 + fineBarkGrain;
    return barkRidge * 0.20;
  }
  if (family === 'stone') return rockDetailHeight(u, v, seed);
  if (family === 'water') return Math.sin(u * Math.PI * 8 + Math.sin(v * Math.PI * 4)) * 0.10 +
    Math.sin((u + v) * Math.PI * 22) * 0.024;
  if (family === 'leaf') {
    // buildLeafballLeafTextures: retained edge/central/secondary vein formula.
    const side = u * 2 - 1, edgeFalloff = Math.sin(Math.PI * v) * (1 - Math.abs(side) * 0.58);
    const leafVein = Math.max(0, 1 - Math.abs(side) * 16) * edgeFalloff;
    const secondaryVeins = Math.max(0, Math.sin((v * 10.5 + Math.abs(side) * 2.7) * Math.PI)) *
      Math.max(0, 1 - Math.abs(side) * 1.25) * edgeFalloff * 0.18;
    return (leafVein + secondaryVeins) * 0.10;
  }
  return detailNoise(u * 5, v * 5, seed) * 0.13 + smoothHashNoise(u * 24, v * 24, seed) * 0.04;
}

/** Creates small albedo/normal/roughness maps without DOM canvas or fetched images. */
export function createPBRFamily(family: Family, color: THREE.ColorRepresentation) {
  const size = 128, height = new Float32Array(size * size);
  const albedo = new Uint8Array(size * size * 4), normal = new Uint8Array(size * size * 4);
  const rough = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    // Four shifted samples crossfade to the same value at opposite tile edges.
    height[y * size + x] = family === 'leaf' ? field(family, u, v) :
      (field(family, u, v) * (1 - u) + field(family, u - 1, v) * u) * (1 - v) +
      (field(family, u, v - 1) * (1 - u) + field(family, u - 1, v - 1) * u) * v;
  }
  const strength = family === 'timber' ? 0.6 : family === 'water' ? 0.8 : family === 'leaf' ? 0.5 : 1.7;
  const n = new THREE.Vector3();
  const at = (x: number, y: number) => height[((y + size) % size) * size + (x + size) % size]!;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = (y * size + x) * 4, h = at(x, y);
    n.set((at(x - 1, y) - at(x + 1, y)) * strength * 12,
      (at(x, y - 1) - at(x, y + 1)) * strength * 12, 1).normalize();
    normal.set([Math.round((n.x * 0.5 + 0.5) * 255), Math.round((n.y * 0.5 + 0.5) * 255), Math.round((n.z * 0.5 + 0.5) * 255), 255], index);
    const shade = family === 'timber' ? 0.93 + h * 1.2 : family === 'leaf' ? 0.80 + h * 1.3 : 0.80 + h * 0.7;
    const val = Math.round(clamp01(shade) * 255);
    albedo.set([val, val, val, 255], index);
    const roughness = family === 'water' ? 0.30 + h * 0.15 : family === 'leaf' ? 0.78 - h * 0.9 :
      family === 'timber' ? 0.81+h*.2 : family === 'wood' ? 0.83 + h * 0.3 : 0.86 + Math.abs(h) * 0.35;
    const r = Math.round(clamp01(roughness) * 255); rough.set([r, r, r, 255], index);
  }
  const makeTexture = (data: Uint8Array, isColor: boolean) => {
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = family === 'leaf' ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true; texture.needsUpdate = true;
    return texture;
  };
  const textures = [makeTexture(albedo, true), makeTexture(normal, false), makeTexture(rough, false)] as const;
  const material = new THREE.MeshStandardMaterial({ color, map: textures[0], normalMap: textures[1],
    roughnessMap: textures[2], roughness: 1, normalScale: new THREE.Vector2(family==='timber'?.16:.45, family==='timber'?.16:.45),
    metalness: 0, side: family === 'leaf' ? THREE.DoubleSide : THREE.FrontSide });
  material.name = `island-nature-${family}`;
  let disposed = false;
  return { material, dispose() { if (disposed) return; disposed = true; material.dispose(); for (const t of textures) t.dispose(); } };
}

export interface IslandSurfaceMaterials {
  ground: THREE.MeshStandardMaterial; wood: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial; water: THREE.MeshStandardMaterial; dispose(): void;
}

/** Call once per scene. Colours remain editable; use metres-based geometry UVs. */
export function createIslandSurfaceMaterials(): IslandSurfaceMaterials {
  const ground = createPBRFamily('ground', '#c1b383'), wood = createPBRFamily('timber', '#876341');
  const stone = createPBRFamily('stone', '#a1a49a'), water = createPBRFamily('water', '#40858d');
  water.material.normalScale.set(0.28, 0.28);
  return { ground: ground.material, wood: wood.material, stone: stone.material, water: water.material,
    dispose() { ground.dispose(); wood.dispose(); stone.dispose(); water.dispose(); } };
}
