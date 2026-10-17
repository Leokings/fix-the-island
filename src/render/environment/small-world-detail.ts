/**
 * Selective SmallWorld adaptations, MIT, Copyright (c) 2026 Paul Robello.
 * Source revision 0416bbcf7dbc58b2782f13698c74ac1dde459613.
 * Full notice: public/licenses/small-world-MIT.txt. See docs/NATURE-PROVENANCE.md.
 */
import * as THREE from 'three';

// src/seed.js: mulberry32, unchanged algorithm; no global Math.random window.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// src/pool.js: get-or-create cache, typed and owned by one adapter instance.
export function makePool<T extends { dispose(): void }>() {
  const map = new Map<string, T>();
  const get = (key: string, factory: () => T): T => {
    let v = map.get(key);
    if (v === undefined) {
      v = factory();
      map.set(key, v);
    }
    return v;
  };
  return { get, dispose: () => { for (const v of map.values()) v.dispose(); map.clear(); } };
}

// src/util.js: buildLeafGeo. Original parametric body retained, reduced grid.
export function buildLeafGeo({
  lengthSegs = 6, widthSegs = 3, length = 0.42, maxWidth = 0.165,
  minWidth = 0.006, profileExp = 0.72, taperEnd = 0.16,
  centerLift = 0.010, centerLiftFade = 0.35, tipCurlStrength = 0.060,
  tipCurlExp = 1.45, edgeCurlStrength = 0.010, centerRibLift = 0.030,
  secondaryRibLift = 0.018, secondaryRibFrequency = 8.5,
} = {}): THREE.BufferGeometry {
  const positions = [], uvs = [], indices = [];
  for (let iy = 0; iy <= lengthSegs; iy++) {
    const v = iy / lengthSegs;
    const profile = Math.sin(Math.PI * v) ** profileExp;
    const taper = taperEnd != null ? (1 - v * taperEnd) : 1;
    const halfWidth = Math.max(minWidth, maxWidth * profile * taper);
    for (let ix = 0; ix <= widthSegs; ix++) {
      const u = ix / widthSegs;
      const side = u * 2 - 1;
      const cl = (1 - Math.abs(side)) * centerLift * (1 - v * centerLiftFade);
      const tc = tipCurlStrength * v ** tipCurlExp;
      const ec = -Math.abs(side) * edgeCurlStrength * Math.sin(Math.PI * v);
      const leafBody = Math.sin(Math.PI * v);
      const centerRib = Math.max(0, 1 - Math.abs(side) * 5.2) * centerRibLift * leafBody;
      const sideRib =
        Math.max(0, Math.sin((v * secondaryRibFrequency + Math.abs(side) * 2.35) * Math.PI)) *
        Math.min(1, Math.abs(side) * 3.4) * Math.max(0, 1 - Math.abs(side) * 1.12) *
        secondaryRibLift * leafBody;
      positions.push(side * halfWidth, -v * length, tc + cl + ec + centerRib + sideRib);
      uvs.push(u, v);
    }
  }
  for (let iy = 0; iy < lengthSegs; iy++) for (let ix = 0; ix < widthSegs; ix++) {
    const a = iy * (widthSegs + 1) + ix, b = a + 1, c = a + widthSegs + 1, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices); geo.computeVertexNormals();
  return geo;
}

// src/grass.js: makeGrassBladeGeometry, exact taper and aTipFactor attribute.
export function makeGrassBladeGeometry(): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(0.10, 0.34, 1, 3);
  const pos = g.attributes.position!;
  const tipFactors = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) + 0.17;
    pos.setY(i, y);
    // Quadratic taper: full width at base, pinches to a point at the tip.
    const t = Math.min(1, y / 0.34);
    const taper = 1.0 - t * t;
    pos.setX(i, pos.getX(i) * taper);
    tipFactors[i] = t;
  }
  g.setAttribute('aTipFactor', new THREE.BufferAttribute(tipFactors, 1));
  return g;
}

// src/flora/trees.js: snowpine.makeBoughGeometry, scalloped skirt topology.
// Snow removed; radial UVs and underside vertex shading added for coastal firs.
export function makeBoughGeometry(): THREE.BufferGeometry {
  const radius = 1, height = 0.9, tierY = 0, boughSegments = 16;
  const topY = tierY + height * 0.52, skirtY = tierY - height * 0.32;
  const vertices: number[] = [], colors: number[] = [], uvs: number[] = [];
  const innerRing: number[] = [], outerRing: number[] = [], undersideRing: number[] = [];
  function pushVertex(x: number, y: number, z: number, shade: number): number {
    const index = vertices.length / 3;
    vertices.push(x, y, z); colors.push(shade, shade, shade); uvs.push(x * 0.5 + 0.5, z * 0.5 + 0.5);
    return index;
  }
  const apex = pushVertex(0, topY, 0, 1.10);
  const undersideCenter = pushVertex(0, skirtY + height * 0.02, 0, 0.55);
  for (let j = 0; j < boughSegments; j++) {
    const a = (j / boughSegments) * Math.PI * 2, point = j % 2 === 0;
    const innerR = radius * (point ? 0.86 : 0.78), outerR = radius * (point ? 1.08 : 0.96);
    const innerY = skirtY + height * 0.035, outerY = skirtY - (point ? height * 0.04 : height * 0.14);
    const ox = Math.cos(a) * outerR, oz = Math.sin(a) * outerR;
    innerRing.push(pushVertex(Math.cos(a) * innerR, innerY, Math.sin(a) * innerR, 0.86));
    outerRing.push(pushVertex(ox, outerY, oz, point ? 0.95 : 0.74));
    undersideRing.push(pushVertex(ox, outerY, oz, 0.58));
  }
  const indices: number[] = [];
  for (let j = 0; j < boughSegments; j++) {
    const next = (j + 1) % boughSegments;
    const innerA = innerRing[j]!, innerB = innerRing[next]!, outerA = outerRing[j]!, outerB = outerRing[next]!;
    indices.push(apex, innerB, innerA, innerA, innerB, outerB, innerA, outerB, outerA);
  }
  for (let j = 0; j < boughSegments; j++) {
    const next = (j + 1) % boughSegments;
    indices.push(undersideCenter, undersideRing[j]!, undersideRing[next]!);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices); geo.computeVertexNormals();
  return geo;
}

export interface NatureWind { readonly time: { value: number }; readonly strength: { value: number } }
type Shader = Parameters<THREE.Material['onBeforeCompile']>[0];

// src/flora/_shared.js: applyLeafPlateWind; local uniforms and defined tipFlex.
const leafWind = `
  #ifdef USE_INSTANCING
    vec3 leafOrigin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #else
    vec3 leafOrigin = vec3(modelMatrix[3].x, modelMatrix[3].y, modelMatrix[3].z);
  #endif
  float phase = leafOrigin.x * 2.1 + leafOrigin.z * 1.6 + leafOrigin.y * 0.7;
  float tipFlex = 1.0 - smoothstep(-0.42, -0.04, position.y);
  float gust = sin(uTime * 1.15 + phase) * 0.65 + sin(uTime * 2.05 + phase * 1.37) * 0.35;
  float flutter = sin(uTime * 3.2 + phase * 1.9 + position.x * 8.0) * 0.45;
  float wind = uLeafPlateWind * uFoliageWind * tipFlex;
  transformed.x += (gust * 0.090 + flutter * 0.026) * wind;
  transformed.y += flutter * 0.018 * wind;
  transformed.z += (gust * 0.125 + flutter * 0.038) * wind;
`;

// src/util.js: applyWindSway, preserving coherent world-to-instance XZ bend.
const stemWind = `
  float windY = max(transformed.y, 0.0);
  float windAmp = windY * windY * uLeafPlateWind * uFoliageWind;
  #ifdef USE_INSTANCING
    vec4 wp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
    vec2 axW = vec2(instanceMatrix[0].x, instanceMatrix[0].z);
    vec2 azW = vec2(instanceMatrix[2].x, instanceMatrix[2].z);
    float invXZScaleSq = 1.0 / max(dot(axW, axW), 1e-6);
  #else
    vec4 wp = modelMatrix * vec4(transformed, 1.0);
    vec2 axW = vec2(1.0, 0.0), azW = vec2(0.0, 1.0);
    float invXZScaleSq = 1.0;
  #endif
  float w1 = sin(uTime * 1.4 + wp.x * 0.30 + wp.z * 0.40);
  float w2 = sin(uTime * 0.9 + wp.x * 0.15 - wp.z * 0.25);
  vec2 windWorld = vec2(w1 * windAmp * 0.06, w2 * windAmp * 0.05);
  transformed.x += dot(axW, windWorld) * invXZScaleSq;
  transformed.z += dot(azW, windWorld) * invXZScaleSq;
`;

/** Same deformation on colour/depth/distance shaders keeps moving shadows aligned. */
export function patchNatureWind(material: THREE.Material, uniforms: NatureWind, mode: 'leaf' | 'stem', strength: number): void {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = function (shader: Shader, renderer: THREE.WebGLRenderer) {
    prev.call(this, shader, renderer);
    for (const anchor of ['#include <common>', '#include <begin_vertex>']) {
      if (!shader.vertexShader.includes(anchor)) throw new Error(`Nature wind shader anchor missing: ${anchor}`);
    }
    shader.uniforms.uTime = uniforms.time; shader.uniforms.uFoliageWind = uniforms.strength;
    shader.uniforms.uLeafPlateWind = { value: strength };
    shader.vertexShader = shader.vertexShader.replace('#include <common>',
      '#include <common>\nuniform float uTime;\nuniform float uFoliageWind;\nuniform float uLeafPlateWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n{${mode === 'leaf' ? leafWind : stemWind}}`);
  };
  material.customProgramCacheKey = () => `island-nature-v1:${mode}:${strength}`;
  material.needsUpdate = true;
}
