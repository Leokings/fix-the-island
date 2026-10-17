import * as THREE from 'three';
import { Kit } from './pump-machinery';

// Presentation only: what the village looks like once its pump is restored.
// The public trough by the path runs, windows glow, chimneys smoke, laundry and
// vegetable rows appear, and the chosen design leaves its own mark (rain barrels
// at the houses, or marker posts along the buried supply line). It reads only
// the eased restoration level the island already tracks; it grants nothing.

export interface VillageHouse { readonly x: number; readonly y: number; readonly z: number; readonly ry: number; readonly variant: number }
export type VillageDesign = 'direct_pump' | 'quiet_pump' | 'rain_cistern' | null;

/** Window centres and chimney tops per house variant, in house-local space (see props.house). */
const WINDOWS: Readonly<Record<number, readonly [number, number, number, number][]>> = {
  0: [[-0.6, 1.15, 1.13, 0], [1.33, 1.15, 0, Math.PI / 2]],
  1: [[-0.55, 1.12, 1.03, 0]],
  2: [[0.5, 1.05, 1.03, 0], [-0.45, 2.3, 1.03, 0], [0.5, 2.3, 1.03, 0]],
  3: [],
};
const CHIMNEYS: Readonly<Record<number, readonly [number, number, number] | undefined>> = { 0: [-0.7, 3.08, -0.3], 1: [0.7, 2.98, -0.35] };
/** A spot beside each house's door (local), clear of the porch, for gardens and barrels. */
const YARD: Readonly<Record<number, readonly [number, number]>> = { 0: [-1.75, 1.0], 1: [-1.6, 0.9], 2: [1.45, 0.9], 3: [-1.85, 0.6] };

const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xffd48a, transparent: true, opacity: 0 });
const smokeMaterial = new THREE.MeshStandardMaterial({ color: 0xe9e4da, transparent: true, opacity: 0.55, roughness: 1, flatShading: true, depthWrite: false });
const streamMaterial = new THREE.MeshStandardMaterial({ color: 0x8fe0f0, transparent: true, opacity: 0.8, roughness: 0.15, emissive: 0x1d6f84, emissiveIntensity: 0.35 });

export class VillageLife {
  readonly group = new THREE.Group();
  private readonly glows: THREE.Mesh[] = [];
  private readonly puffs: { mesh: THREE.Mesh; base: THREE.Vector3; phase: number }[] = [];
  private readonly grow: THREE.Object3D[] = [];
  private readonly cloths: THREE.Object3D[] = [];
  private readonly rainMarks: THREE.Group;
  private readonly lineMarks: THREE.Group;
  private readonly troughWater: THREE.Mesh;
  private readonly stream: THREE.Mesh;
  private readonly splash: THREE.Mesh[] = [];
  private readonly brokenSpout: THREE.Group;
  private readonly spout: THREE.Group;
  private design: VillageDesign = null;

  constructor(houses: readonly VillageHouse[], trough: { x: number; y: number; z: number; ry: number }, pump: { x: number; y: number; z: number }, heightAt: (x: number, z: number) => number) {
    this.group.name = 'village-life';
    // ——— Houses: window glow, chimney smoke, a vegetable patch by each door ———
    for (const [i, h] of houses.entries()) {
      const g = new THREE.Group(); g.position.set(h.x, h.y, h.z); g.rotation.y = h.ry; this.group.add(g);
      for (const [x, y, z, ry] of WINDOWS[h.variant] ?? []) {
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.38), glowMaterial);
        pane.position.set(x, y, z); pane.rotation.y = ry; pane.translateZ(0.045); g.add(pane); this.glows.push(pane);
      }
      const chimney = CHIMNEYS[h.variant];
      if (chimney) for (let k = 0; k < 5; k++) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), smokeMaterial);
        g.add(puff); this.puffs.push({ mesh: puff, base: new THREE.Vector3(...chimney), phase: k / 5 + i * 0.13 });
      }
      const [yx, yz] = YARD[h.variant] ?? [-1.6, 0.9];
      const patch = new THREE.Group(); patch.position.set(yx, 0, yz); g.add(patch);
      const pk = new Kit(patch, false);
      pk.box(0.9, 0.06, 0.7, 'mud', 0, 0.03, 0);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
        const sprout = new THREE.Group(); sprout.position.set(-0.32 + c * 0.21, 0.06, -0.22 + r * 0.22); patch.add(sprout);
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), new THREE.MeshStandardMaterial({ color: (r + c) % 3 ? 0x6fae3e : 0x89c24a, flatShading: true, roughness: 0.9 }));
        leaf.scale.set(1, 0.7, 1); leaf.position.y = 0.06; leaf.castShadow = true; sprout.add(leaf);
        this.grow.push(sprout);
      }
      this.grow.push(patch);
    }
    // ——— Washing line across the porch cottage's front yard ———
    const home = houses.find(h => h.variant === 0);
    if (home) {
      const local = (u: number, w: number) => new THREE.Vector3(home.x + u * Math.cos(home.ry) + w * Math.sin(home.ry), 0, home.z - u * Math.sin(home.ry) + w * Math.cos(home.ry));
      const from = local(-1.7, 3.1), to = local(1.5, 3.4);
      from.y = heightAt(from.x, from.z); to.y = heightAt(to.x, to.z);
      const line = new THREE.Group(); this.group.add(line); this.grow.push(line);
      const lk = new Kit(line, false), top = Math.max(from.y, to.y) + 1.6;
      for (const p of [from, to]) lk.box(0.07, top - p.y + 0.05, 0.07, 'timberDark', p.x, (top + p.y) / 2, p.z);
      const dir = new THREE.Vector3(to.x - from.x, 0, to.z - from.z), len = dir.length();
      const rope = lk.cyl(0.012, 0.012, len, 'rope', (from.x + to.x) / 2, top - 0.04, (from.z + to.z) / 2);
      rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      const colours = [0xe86f68, 0xf2c14e, 0x5fa8d3, 0xf7f0e6, 0x8bc06a];
      for (let k = 1; k < 6; k++) {
        const t = k / 6, p = from.clone().lerp(to, t);
        const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.46), new THREE.MeshStandardMaterial({ color: colours[k % colours.length]!, side: THREE.DoubleSide, roughness: 0.9 }));
        const pivot = new THREE.Group(); pivot.position.set(p.x, top - 0.06 - Math.sin(t * Math.PI) * 0.1, p.z);
        pivot.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI / 2; cloth.position.y = -0.24; cloth.castShadow = true;
        pivot.add(cloth); line.add(pivot); this.cloths.push(pivot);
      }
    }
    // ——— The public trough: dry and cracked in the storm, running once the pump works ———
    const tg = new THREE.Group(); tg.position.set(trough.x, trough.y, trough.z); tg.rotation.y = trough.ry; this.group.add(tg);
    const tk = new Kit(tg, false);
    tk.box(1.3, 0.5, 0.62, 'stone', 0, 0.25, 0);
    tk.box(1.12, 0.06, 0.44, 'mud', 0, 0.42, 0);
    tk.box(0.22, 1.05, 0.22, 'stone', -0.72, 0.52, 0);
    tk.box(0.3, 0.08, 0.3, 'flag', -0.72, 1.08, 0);
    this.troughWater = tk.box(1.12, 0.02, 0.44, 'water', 0, 0.47, 0);
    this.spout = new THREE.Group(); tg.add(this.spout);
    const sk = new Kit(this.spout, false);
    sk.cyl(0.035, 0.03, 0.26, 'brass', -0.56, 0.86, 0, 0, 0, Math.PI / 2 - 0.25);
    this.stream = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.4, 8, 1, true), streamMaterial);
    this.stream.position.set(-0.42, 0.67, 0); tg.add(this.stream);
    for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 4, 12), streamMaterial); s.rotation.x = Math.PI / 2; s.position.set(-0.42, 0.49, 0); tg.add(s); this.splash.push(s); }
    this.brokenSpout = new THREE.Group(); tg.add(this.brokenSpout);
    const bk = new Kit(this.brokenSpout, true);
    bk.cyl(0.035, 0.03, 0.18, 'brass', -0.6, 0.86, 0, 0, 0, Math.PI / 2 - 0.9);
    bk.box(0.18, 0.05, 0.1, 'stone', 0.35, 0.03, 0.42, 0, 0.6, 0.2);
    // Buckets waiting their turn.
    for (const [x, z] of [[0.85, 0.15], [0.95, -0.28]] as const) { tk.cyl(0.11, 0.09, 0.22, 'timber', x, 0.11, z, 0, 0, 0, 8); tk.ring(0.11, 0.01, 'ironDark', x, 0.2, z, Math.PI / 2); }
    // ——— Design marks ———
    this.rainMarks = new THREE.Group(); this.group.add(this.rainMarks);
    for (const h of houses) {
      const g = new THREE.Group(); g.position.set(h.x, h.y, h.z); g.rotation.y = h.ry; this.rainMarks.add(g);
      const rk = new Kit(g, false), side = h.variant === 2 ? -1.35 : 1.45;
      rk.cyl(0.26, 0.24, 0.72, 'timber', side, 0.36, -0.55, 0, 0, 0, 10);
      for (const y of [0.16, 0.56]) rk.ring(0.255, 0.014, 'ironDark', side, y, -0.55, Math.PI / 2);
      rk.cyl(0.25, 0.25, 0.03, 'water', side, 0.7, -0.55, 0, 0, 0, 10);
      rk.cyl(0.03, 0.03, 1.2, 'galv', side - Math.sign(side) * 0.12, 1.32, -0.55);
    }
    this.lineMarks = new THREE.Group(); this.group.add(this.lineMarks);
    const from = new THREE.Vector3(pump.x, pump.y, pump.z), to = new THREE.Vector3(trough.x, trough.y, trough.z);
    for (let k = 1; k < 5; k++) {
      const p = from.clone().lerp(to, k / 5), g = new THREE.Group(); g.position.set(p.x + 0.9, heightAt(p.x + 0.9, p.z + 0.4), p.z + 0.4); this.lineMarks.add(g);
      const mk = new Kit(g, false);
      mk.box(0.07, 0.5, 0.07, 'timber', 0, 0.25, 0);
      mk.box(0.12, 0.08, 0.12, 'blue', 0, 0.52, 0);
    }
    this.update(0, 0);
  }

  /** Which pump design was installed: decides the rain barrels or the supply-line posts. */
  setDesign(design: VillageDesign): void { this.design = design; }

  /** level: eased 0..1 restoration of the village pump. */
  update(level: number, seconds: number): void {
    const on = level > 0.01;
    glowMaterial.opacity = level * 0.85;
    for (const g of this.glows) g.visible = on;
    for (const p of this.puffs) {
      p.mesh.visible = on;
      if (!on) continue;
      const t = (seconds * 0.35 + p.phase) % 1;
      p.mesh.position.set(p.base.x + Math.sin(t * 4 + p.phase * 9) * 0.12 + t * 0.25, p.base.y + t * 1.3, p.base.z);
      p.mesh.scale.setScalar((0.6 + t * 1.4) * level);
    }
    smokeMaterial.opacity = 0.5 * level;
    for (const g of this.grow) { g.visible = on; g.scale.set(1, Math.max(0.01, level), 1); }
    for (const [k, c] of this.cloths.entries()) c.rotation.z = Math.sin(seconds * 2.2 + k) * 0.18 * level;
    this.troughWater.visible = on;
    this.troughWater.scale.set(1, 1, Math.max(0.01, level));
    this.stream.visible = this.spout.visible = level > 0.5;
    this.brokenSpout.visible = level <= 0.5;
    for (const [k, s] of this.splash.entries()) {
      s.visible = level > 0.5;
      const t = (seconds * 1.4 + k / 3) % 1;
      s.scale.setScalar(0.6 + t * 2.2); (s.material as THREE.Material).opacity = 0.8;
    }
    this.rainMarks.visible = on && this.design === 'rain_cistern';
    this.lineMarks.visible = on && !!this.design && this.design !== 'rain_cistern';
    for (const g of [this.rainMarks, this.lineMarks]) g.scale.set(1, Math.max(0.01, level), 1);
  }
}
