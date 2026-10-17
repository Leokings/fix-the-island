import * as THREE from 'three';
import type { Consequences, Level, VillagePumpDesignId } from '../../genlayer/council/types';
import { creekZ, groundHeight } from './terrain';

const mat = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra });
const C = {
  wood: 0x8a5a36, woodDark: 0x5e3b22, iron: 0x56656b, rust: 0x9c5a33, copper: 0xc9824a,
  stone: 0x9a978c, mesh: 0xcfd6d3, water: 0x5fc3d6, roof: 0xb4553a, plaster: 0xf0e2c4, egg: 0xf6efd9,
  shell: 0x5f7f3c, shellDark: 0x3e5a2a, leaf: 0x5a9a44, flower: [0xf2c14e, 0xe86f68, 0xf7f0e6, 0xb889d6],
};
const LEVEL_VALUE: Record<Level, number> = { worse: -1, same: 0, better: 1, much_better: 2 };

function at(obj: THREE.Object3D, x: number, z: number, lift = 0): THREE.Object3D {
  obj.position.set(x, groundHeight(x, z) + lift, z);
  return obj;
}
function shadowy<T extends THREE.Object3D>(o: T): T {
  o.traverse(c => { if (c instanceof THREE.Mesh) { c.castShadow = true; c.receiveShadow = true; } });
  return o;
}

/** Where the site sits relative to the council clearing. */
export const PUMP_X = 4.2;
export const PUMP_Z = creekZ(PUMP_X) + 2.4;
export const SITE_FOCUS = new THREE.Vector3(PUMP_X + 1, 0.6, PUMP_Z - 1.4);

function brokenPump(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.9), mat(C.stone));
  base.position.y = 0.15;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.1, 8), mat(C.rust, { roughness: 1 }));
  body.position.set(0.05, 0.75, 0); body.rotation.z = 0.32;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.06), mat(C.woodDark));
  handle.position.set(-0.55, 0.32, 0.4); handle.rotation.set(0.2, 0.6, -0.15);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.4, 6), mat(C.rust));
  pipe.rotation.x = Math.PI / 2; pipe.position.set(0.1, 0.12, -1.1);
  const crack = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 6), mat(C.rust));
  crack.rotation.set(Math.PI / 2, 0, 0.8); crack.position.set(0.6, 0.08, -2.0);
  g.add(base, body, handle, pipe, crack);
  return shadowy(g);
}

/** Loud, high-flow pump with an open intake straight into the creek. */
function directPump(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 1.1), mat(C.stone)); base.position.y = 0.15;
  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.7), mat(0xc8463a, { roughness: 0.55 }));
  engine.position.y = 0.6; engine.name = 'vibrate';
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.6, 6), mat(C.iron));
  stack.position.set(0.25, 1.15, 0.15); stack.name = 'exhaust';
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 12), mat(C.iron));
  wheel.position.set(-0.45, 0.65, 0); wheel.rotation.y = Math.PI / 2; wheel.name = 'spin';
  const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.3, 8), mat(C.iron));
  intake.rotation.x = Math.PI / 2 - 0.12; intake.position.set(0, 0.35, -1.5);
  const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.12, 0.25, 8, 1, true), mat(C.iron, { side: THREE.DoubleSide }));
  mouth.rotation.x = Math.PI / 2; mouth.position.set(0, 0.2, -2.7);
  g.add(base, engine, stack, wheel, intake, mouth);
  return shadowy(g);
}

/** Smaller pump; intake sits off to the side behind a mesh screen. */
function quietPump(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.25, 10), mat(C.stone)); base.position.y = 0.12;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.9, 10), mat(0x3e7d8c, { roughness: 0.5 }));
  body.position.y = 0.7;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.copper, { metalness: 0.4, roughness: 0.4 }));
  cap.position.y = 1.15;
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.05, 0.05), mat(C.wood));
  lever.position.set(-0.3, 1.1, 0); lever.name = 'lever';
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6), mat(C.copper, { metalness: 0.3 }));
  pipe.rotation.set(Math.PI / 2 - 0.1, 0, -0.5); pipe.position.set(-0.55, 0.3, -1.3);
  const screen = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.55, 10, 1, true), mat(C.mesh, { wireframe: true }));
  screen.position.set(-1.1, 0.0, -2.4);
  const screenTop = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 10), mat(C.mesh));
  screenTop.position.set(-1.1, 0.29, -2.4);
  g.add(base, body, cap, lever, pipe, screen, screenTop);
  return shadowy(g);
}

/** Rain catcher: sloped roof, gutter and a tall wooden tank. */
function rainCistern(): THREE.Group {
  const g = new THREE.Group();
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 1.5, 12), mat(C.wood));
  tank.position.set(0, 0.75, 0);
  for (const y of [0.25, 0.75, 1.25]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.03, 4, 16).rotateX(Math.PI / 2), mat(C.iron));
    hoop.position.y = y; g.add(hoop);
  }
  const lid = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.35, 12), mat(C.roof));
  lid.position.y = 1.68;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.6), mat(C.roof));
  roof.position.set(-1.4, 2.0, 0.2); roof.rotation.z = 0.22;
  for (const [x, z] of [[-2.3, -0.4], [-2.3, 0.8], [-0.6, -0.4], [-0.6, 0.8]] as const) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.0 - (x + 2.3) * 0.22, 0.09), mat(C.woodDark));
    post.position.set(x, (2.0 - (x + 2.3) * 0.22) / 2, z); g.add(post);
  }
  const gutter = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6, 1, true), mat(C.copper, { side: THREE.DoubleSide }));
  gutter.rotation.z = Math.PI / 2 - 0.25; gutter.position.set(-0.35, 1.85, 0.2);
  const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6), mat(C.copper));
  tap.rotation.z = Math.PI / 2; tap.position.set(0.75, 0.3, 0.2);
  g.add(tank, lid, roof, gutter, tap);
  return shadowy(g);
}

function turtle(): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.shell));
  shell.scale.set(1, 0.7, 1.25);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), mat(C.shellDark));
  head.position.set(0, 0.04, 0.27);
  for (const [x, z] of [[0.15, 0.15], [-0.15, 0.15], [0.15, -0.15], [-0.15, -0.15]] as const) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.07), mat(C.shellDark));
    fin.position.set(x, 0.02, z); g.add(fin);
  }
  g.add(shell, head);
  return shadowy(g);
}

function nest(): THREE.Group {
  const g = new THREE.Group();
  const mound = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xd9c38f));
  mound.scale.y = 0.35; g.add(mound);
  for (let i = 0; i < 4; i++) {
    const egg = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), mat(C.egg));
    const a = i * 1.7;
    egg.position.set(Math.cos(a) * 0.12, 0.12, Math.sin(a) * 0.12); egg.scale.y = 1.25; egg.name = 'egg';
    g.add(egg);
  }
  return shadowy(g);
}

function bird(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.25, 4), mat(0xf7f3ea));
  body.rotation.x = Math.PI / 2;
  const wingGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -0.05), new THREE.Vector3(0.3, 0, 0), new THREE.Vector3(0, 0, 0.07)]);
  wingGeo.computeVertexNormals();
  const wm = new THREE.MeshStandardMaterial({ color: 0xf7f3ea, side: THREE.DoubleSide, flatShading: true });
  const l = new THREE.Mesh(wingGeo, wm), r = new THREE.Mesh(wingGeo, wm);
  r.scale.x = -1; l.name = 'wingL'; r.name = 'wingR';
  g.add(body, l, r);
  return g;
}

function flowerPatch(seed: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = seed * 3.3 + i * 2.1, r = 0.15 + ((seed * 13 + i * 7) % 5) * 0.08;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.22, 3), mat(C.leaf));
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), mat(C.flower[(seed + i) % C.flower.length]!));
    stem.position.set(Math.cos(a) * r, 0.11, Math.sin(a) * r);
    head.position.set(Math.cos(a) * r, 0.24, Math.sin(a) * r);
    g.add(stem, head);
  }
  return g;
}

/** Small water particles, re-used for spout flow, rain and exhaust puffs. */
class Droplets {
  readonly points: THREE.Points;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private rate = 0;
  private acc = 0;
  constructor(count: number, color: number, size: number, private readonly spawn: (p: THREE.Vector3, v: THREE.Vector3) => void, private readonly gravity = -9) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3).fill(-999), 3));
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.85, depthWrite: false }));
    this.points.frustumCulled = false;
  }
  setRate(r: number) { this.rate = r; }
  update(dt: number): void {
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute, a = pos.array as Float32Array;
    const p = new THREE.Vector3(), v = new THREE.Vector3();
    this.acc += this.rate * dt;
    for (let i = 0; i < this.life.length; i++) {
      if (this.life[i]! <= 0) {
        if (this.acc >= 1) { this.acc -= 1; this.spawn(p, v); p.toArray(a, i * 3); v.toArray(this.vel, i * 3); this.life[i] = 1.4; }
        else { a[i * 3 + 1] = -999; continue; }
      }
      this.life[i]! -= dt;
      this.vel[i * 3 + 1]! += this.gravity * dt;
      for (let k = 0; k < 3; k++) a[i * 3 + k]! += this.vel[i * 3 + k]! * dt;
      if (a[i * 3 + 1]! < -0.5) this.life[i] = 0;
    }
    pos.needsUpdate = true;
  }
}

export interface SiteView { design: VillagePumpDesignId | null; consequences: Consequences | null }

/** The village pump diorama. Only consequence levels it is given change it. */
export class PumpSite {
  readonly group = new THREE.Group();
  private readonly designs: Record<VillagePumpDesignId | 'broken', THREE.Group>;
  private readonly nests: THREE.Group[] = [];
  private readonly turtles: { obj: THREE.Group; home: THREE.Vector3; phase: number }[] = [];
  private readonly birds: { obj: THREE.Group; r: number; h: number; phase: number }[] = [];
  private readonly flowers: THREE.Group[] = [];
  private readonly troughWater: THREE.Mesh;
  private readonly spout: Droplets;
  private readonly rain: Droplets;
  private readonly smoke: Droplets;
  private readonly upkeep: THREE.Group;
  private view: SiteView = { design: null, consequences: null };
  private readonly burstRing: THREE.Mesh;
  private readonly sparkles: Droplets;
  private burst = 1;
  private shown: VillagePumpDesignId | 'broken' = 'broken';
  private grow = 1;
  // Smoothed 0..1 presentation values.
  private water = 0; private habitat = 0; private wear = 0;
  private tWater = 0; private tHabitat = 0; private tWear = 0;

  constructor() {
    const site = new THREE.Group();
    at(site, PUMP_X, PUMP_Z);
    this.group.add(site);
    this.designs = { broken: brokenPump(), direct_pump: directPump(), quiet_pump: quietPump(), rain_cistern: rainCistern() };
    for (const [id, d] of Object.entries(this.designs)) { d.visible = id === 'broken'; site.add(d); }

    // Village trough on the clearing side, where the water arrives.
    const trough = new THREE.Group();
    const tub = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.6), mat(C.wood)); tub.position.y = 0.2;
    const inner = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.36, 0.45), mat(C.woodDark)); inner.position.y = 0.24;
    this.troughWater = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.02, 0.42), mat(C.water, { roughness: 0.1, metalness: 0.1 }));
    this.troughWater.position.y = 0.06;
    const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 6), mat(C.copper, { metalness: 0.3 }));
    feed.rotation.z = Math.PI / 2; feed.position.set(-1.25, 0.55, 0);
    const feedDown = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.25, 6), mat(C.copper));
    feedDown.position.set(-0.55, 0.45, 0);
    trough.add(tub, inner, this.troughWater, feed, feedDown);
    at(trough, PUMP_X + 2.6, PUMP_Z + 0.4);
    trough.rotation.y = -0.15;
    this.group.add(shadowy(trough));
    const spoutAt = new THREE.Vector3();
    trough.updateMatrixWorld(true);
    trough.localToWorld(spoutAt.set(-0.55, 0.33, 0));
    this.spout = new Droplets(260, 0xa6ecf7, 0.11, (p, v) => {
      p.copy(spoutAt).add(new THREE.Vector3((Math.random() - 0.5) * 0.04, 0, (Math.random() - 0.5) * 0.04));
      v.set((Math.random() - 0.5) * 0.3, -0.4, (Math.random() - 0.5) * 0.3);
    });
    this.group.add(this.spout.points);

    const roofAt = new THREE.Vector3(PUMP_X - 1.4, groundHeight(PUMP_X, PUMP_Z) + 3.4, PUMP_Z + 0.2);
    this.rain = new Droplets(400, 0xbfe3ee, 0.05, (p, v) => {
      p.set(roofAt.x + (Math.random() - 0.5) * 2.4, roofAt.y + Math.random(), roofAt.z + (Math.random() - 0.5) * 1.8);
      v.set(0.3, -6, 0);
    }, -2);
    this.group.add(this.rain.points);

    const stackAt = new THREE.Vector3(PUMP_X + 0.25, groundHeight(PUMP_X, PUMP_Z) + 1.5, PUMP_Z + 0.15);
    this.smoke = new Droplets(80, 0x8e8a86, 0.22, (p, v) => {
      p.copy(stackAt); v.set(0.25 + Math.random() * 0.2, 0.9 + Math.random() * 0.4, (Math.random() - 0.5) * 0.2);
    }, 0.2);
    this.group.add(this.smoke.points);

    // Nesting beach on the far creek bank.
    for (const [dx, dz] of [[-0.5, -2.1], [0.9, -2.5], [2.2, -2.2], [-1.6, -2.7]] as const) {
      const n = nest();
      at(n, PUMP_X + dx, creekZ(PUMP_X + dx) - 2.0 + dz * 0.3 - 0.4, -0.02);
      this.nests.push(n); this.group.add(n);
    }
    for (let i = 0; i < 5; i++) {
      const t = turtle();
      const home = new THREE.Vector3(PUMP_X - 2 + i * 1.2, 0, creekZ(PUMP_X - 2 + i * 1.2) - 1.5 - (i % 2) * 0.6);
      home.y = groundHeight(home.x, home.z);
      t.position.copy(home); t.rotation.y = i * 1.3;
      this.turtles.push({ obj: t, home, phase: i * 1.7 });
      this.group.add(t);
    }
    for (let i = 0; i < 6; i++) {
      const b = bird();
      this.birds.push({ obj: b, r: 3 + i * 0.6, h: 3 + (i % 3) * 0.6, phase: i * 1.1 });
      this.group.add(b);
    }
    for (let i = 0; i < 14; i++) {
      const a = i * 0.9, r = 3 + (i % 4) * 1.4;
      const x = PUMP_X + Math.cos(a) * r * 1.3, z = PUMP_Z + Math.sin(a) * r * 0.6 - 2;
      if (Math.abs(z - creekZ(x)) < 1.6) continue;
      const f = flowerPatch(i);
      at(f, x, z);
      this.flowers.push(f); this.group.add(f);
    }

    // Upkeep marker: an oil can and wrench left by the machine.
    this.upkeep = new THREE.Group();
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.28, 8), mat(0xc8463a)); can.position.y = 0.14;
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, 0.3, 5), mat(C.iron));
    nozzle.position.set(0.12, 0.32, 0); nozzle.rotation.z = -0.9;
    const spanner = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.06), mat(0xb8c1c6));
    spanner.position.set(-0.25, 0.02, 0.12); spanner.rotation.y = 0.5;
    this.upkeep.add(can, nozzle, spanner);
    at(this.upkeep, PUMP_X + 0.9, PUMP_Z + 0.7);
    this.group.add(shadowy(this.upkeep));
    // Restoration burst: a ring of light and rising sparkles when approval lands.
    this.burstRing = new THREE.Mesh(new THREE.RingGeometry(0.96, 1.0, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    at(this.burstRing, PUMP_X, PUMP_Z, 0.15);
    this.group.add(this.burstRing);
    const burstAt = this.burstRing.position.clone();
    this.sparkles = new Droplets(160, 0xfff3c4, 0.09, (p, v) => {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 3.5;
      p.set(burstAt.x + Math.cos(a) * r, burstAt.y, burstAt.z + Math.sin(a) * r - 1);
      v.set(0, 1.2 + Math.random() * 1.6, 0);
    }, 0.3);
    (this.sparkles.points.material as THREE.PointsMaterial).blending = THREE.AdditiveBlending;
    this.group.add(this.sparkles.points);
    this.apply(true);
  }

  /** Show a design (or the broken pump) plus any consequence levels to visualise. */
  setView(view: SiteView, instant = false): void {
    const changed = view.design !== this.view.design;
    const restoring = !this.view.consequences && !!view.consequences;
    this.view = view;
    if (restoring && !instant) this.burst = 0;
    if (changed) this.grow = instant ? 1 : 0;
    this.apply(instant);
  }

  private apply(instant: boolean): void {
    const c = this.view.consequences;
    // Damaged baseline: low water, stressed habitat, broken machine.
    this.tWater = c ? THREE.MathUtils.clamp(0.25 + LEVEL_VALUE[c.water] * 0.37, 0, 1) : 0.15;
    this.tHabitat = c ? THREE.MathUtils.clamp(0.4 + LEVEL_VALUE[c.habitat] * 0.3, 0, 1) : 0.35;
    this.tWear = c ? THREE.MathUtils.clamp(0.4 - LEVEL_VALUE[c.maintenance] * 0.4, 0, 1) : 0;
    if (instant) { this.water = this.tWater; this.habitat = this.tHabitat; this.wear = this.tWear; }
  }

  /** 0..1 water and habitat, for the scene to drive creek level and ground colour. */
  get waterLevel(): number { return this.water; }
  get habitatLevel(): number { return this.habitat; }
  get restored(): boolean { return !!this.view.consequences; }

  update(dt: number, t: number): void {
    const k = Math.min(1, dt * 0.9);
    this.water += (this.tWater - this.water) * k;
    this.habitat += (this.tHabitat - this.habitat) * k;
    this.wear += (this.tWear - this.wear) * k;

    const want = this.view.design ?? 'broken';
    if (want !== this.shown) {
      this.designs[this.shown].visible = false;
      this.shown = want;
      this.designs[want].visible = true;
    }
    this.grow = Math.min(1, this.grow + dt * 1.6);
    const s = this.grow < 1 ? 1 - Math.pow(1 - this.grow, 3) * Math.cos(this.grow * 9) : 1;
    this.designs[this.shown].scale.set(1, Math.max(0.01, s), 1);

    const running = this.restored;
    const d = this.designs[this.shown];
    d.getObjectByName('vibrate')?.position.set(running ? Math.sin(t * 60) * 0.012 : 0, 0.6, 0);
    const spin = d.getObjectByName('spin'); if (spin && running) spin.rotation.x += dt * 9;
    const lever = d.getObjectByName('lever'); if (lever) lever.rotation.z = running ? Math.sin(t * 2.2) * 0.35 : 0;

    this.spout.setRate(running ? 30 + this.water * 120 : 0);
    this.rain.setRate(running && this.shown === 'rain_cistern' ? 70 : 0);
    this.smoke.setRate(running && this.shown === 'direct_pump' ? 9 : 0);
    this.spout.update(dt); this.rain.update(dt); this.smoke.update(dt);
    this.troughWater.position.y = 0.06 + this.water * 0.28;
    this.troughWater.visible = this.water > 0.2;

    // Habitat: eggs and turtles thrive or retreat, birds circle when calm.
    const h = this.habitat;
    this.nests.forEach((n, i) => n.children.forEach((c, j) => { if (c.name === 'egg') c.visible = h > 0.15 + ((i + j) % 4) * 0.18; }));
    this.turtles.forEach((tt, i) => {
      const present = h > 0.25 + i * 0.13;
      const sc = THREE.MathUtils.lerp(tt.obj.scale.x, present ? 1 : 0.001, Math.min(1, dt * 3));
      tt.obj.scale.setScalar(sc);
      tt.obj.visible = sc > 0.01;
      const wob = Math.sin(t * 0.6 + tt.phase);
      tt.obj.position.set(tt.home.x + wob * 0.3, tt.home.y, tt.home.z + Math.cos(t * 0.4 + tt.phase) * 0.15);
      tt.obj.rotation.y = tt.phase + wob * 0.6;
    });
    const loud = running && this.shown === 'direct_pump';
    this.birds.forEach((b, i) => {
      const present = h > 0.45 + i * 0.08;
      const fly = t * (loud ? 0.9 : 0.35) + b.phase;
      const r = b.r + (loud ? 6 : 0);
      b.obj.visible = present || loud;
      b.obj.position.set(PUMP_X + Math.cos(fly) * r, b.h + (loud ? 3 : 0) + Math.sin(fly * 2) * 0.3, PUMP_Z - 3 + Math.sin(fly) * r * 0.6);
      b.obj.rotation.y = -fly;
      const flap = Math.sin(t * (loud ? 16 : 8) + i) * 0.6;
      b.obj.getObjectByName('wingL')!.rotation.z = flap;
      b.obj.getObjectByName('wingR')!.rotation.z = -flap;
    });
    this.flowers.forEach((f, i) => {
      const target = h > 0.55 + (i % 5) * 0.08 ? 1 : 0.001;
      const sc = THREE.MathUtils.lerp(f.scale.x, target, Math.min(1, dt * 2.5));
      f.scale.setScalar(sc); f.visible = sc > 0.01;
    });
    this.upkeep.visible = running && this.wear > 0.5;
    if (this.burst < 1) {
      this.burst = Math.min(1, this.burst + dt / 2.4);
      const e = 1 - Math.pow(1 - this.burst, 3);
      this.burstRing.scale.setScalar(0.5 + e * 7);
      (this.burstRing.material as THREE.MeshBasicMaterial).opacity = Math.pow(1 - this.burst, 2) * 0.85;
    }
    this.sparkles.setRate(this.burst < 0.7 ? 140 : 0);
    this.sparkles.update(dt);
  }
}
