import * as THREE from 'three';
import { fbm } from './terrain';

export type FireMood = 'bright' | 'steady' | 'low';

const mat = (color: number) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85 });
function rock(seed: number, size: number): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(size, 0);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.8 + fbm(i, seed) * 0.5), p.getY(i) * 0.6, p.getZ(i) * (0.8 + fbm(seed, i) * 0.5));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat(0x8f8b80));
}

/** Council fire: flames, embers and a flickering light; its mood follows the council's state. */
export class Campfire {
  readonly group = new THREE.Group();
  readonly light = new THREE.PointLight(0xff9a4a, 13, 12, 1.4);
  private readonly flames: THREE.Mesh[] = [];
  private readonly embers: THREE.Points;
  private readonly emberVel: Float32Array;
  private intensity = 1;
  private target = 1;
  /** ring: false when the scene already has its own stones and logs. */
  constructor(ring = true) {
    if (ring) for (let i = 0; i < 9; i++) {
      const s = rock(i, 0.22);
      const a = (i / 9) * Math.PI * 2;
      s.position.set(Math.cos(a) * 0.62, 0.08, Math.sin(a) * 0.62);
      this.group.add(s);
    }
    if (ring) for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.9, 6), mat(0x5a3a22));
      log.rotation.set(Math.PI / 2 - 0.35, (i / 4) * Math.PI * 2, 0);
      log.position.y = 0.15; this.group.add(log);
    }
    const colors = [0xffd27a, 0xff9a3d, 0xff6a2a];
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.28 - i * 0.06, 0.9 - i * 0.15, 6, 1, true),
        new THREE.MeshBasicMaterial({ color: colors[i]!, transparent: true, opacity: 0.9 - i * 0.15, depthWrite: false, side: THREE.DoubleSide }));
      f.position.y = 0.5; f.renderOrder = 2 + i;
      this.flames.push(f); this.group.add(f);
    }
    this.light.position.y = 0.9;
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(512, 512);
    this.light.shadow.bias = -0.004;
    this.group.add(this.light);
    const n = 60;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.emberVel = new Float32Array(n);
    this.embers = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffb36b, size: 0.05, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    for (let i = 0; i < n; i++) this.resetEmber(i, Math.random() * 2.5);
    this.group.add(this.embers);
  }
  private resetEmber(i: number, y = 0.4): void {
    const a = this.embers.geometry.getAttribute('position').array as Float32Array;
    a[i * 3] = (Math.random() - 0.5) * 0.4; a[i * 3 + 1] = y; a[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    this.emberVel[i] = 0.5 + Math.random() * 0.9;
  }
  setMood(mood: FireMood): void { this.target = mood === 'bright' ? 1.35 : mood === 'steady' ? 1 : 0.35; }
  update(dt: number, t: number): void {
    this.intensity += (this.target - this.intensity) * Math.min(1, dt * 1.5);
    const k = this.intensity;
    this.flames.forEach((f, i) => {
      const flick = 0.85 + Math.sin(t * (9 + i * 3)) * 0.08 + Math.sin(t * (23 + i * 5)) * 0.06;
      f.scale.set(k * (0.9 + 0.1 * Math.sin(t * 7 + i)), k * flick, k * (0.9 + 0.1 * Math.cos(t * 6 + i)));
      f.position.y = 0.2 + (0.45 - i * 0.07) * k * flick;
      f.rotation.y = t * (0.6 + i * 0.4);
    });
    this.light.intensity = 13 * k * (0.9 + Math.sin(t * 13) * 0.06 + Math.sin(t * 31) * 0.04);
    const a = this.embers.geometry.getAttribute('position').array as Float32Array;
    for (let i = 0; i < this.emberVel.length; i++) {
      a[i * 3 + 1]! += this.emberVel[i]! * dt * k;
      a[i * 3]! += Math.sin(t * 2 + i) * dt * 0.2;
      if (a[i * 3 + 1]! > 1.2 + k * 1.8) this.resetEmber(i);
    }
    this.embers.geometry.getAttribute('position').needsUpdate = true;
    (this.embers.material as THREE.PointsMaterial).opacity = Math.min(1, k);
  }
}

