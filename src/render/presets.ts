import type { CameraPreset, RenderStyle } from './contract';

// Main locked these exact presets after the fresh B-01 loop-only review.
export const WALK_CAMERA: CameraPreset = Object.freeze({ yawDegrees: 35, pitchDegrees: 52, span: 8.4, distance: 32, targetHeight: 0.85, followSeconds: 0.14 });
export const INSPECT_CAMERA: CameraPreset = Object.freeze({ yawDegrees: 35, pitchDegrees: 58, span: 5.8, distance: 32, targetHeight: 1.1, followSeconds: 0.14 });
// Stylized island daylight (GAME-DESIGN §12): one warm key sun, modest sky fill, no wash-out.
export const WARM_STYLE: RenderStyle = Object.freeze({ id: 'warm-island', ground: '#a7ad63', wood: '#ac7a46', metal: '#6f918b', foliage: '#567644', water: '#398da0', fog: '#bcd6e4', keyColor: '#ffe2bb', keyIntensity: 3.1, keyOffset: [-36, 55, 12] as const, fillSky: '#cfe2f2', fillGround: '#7d8452', exposure: 0.97, roughness: 0.86, fill: 1.25 });
export const COOL_STYLE: RenderStyle = Object.freeze({ id: 'cool-smoke', ground: '#c7c8d5', wood: '#a77a50', metal: '#829a9f', foliage: '#53766c', water: '#487f9d', fog: '#c5c9e6', keyColor: '#f4eddf', keyIntensity: 2.35, keyOffset: [-36, 55, 12] as const, fillSky: '#d3cff4', fillGround: '#9697b6', exposure: 1.02, roughness: 0.86 });
