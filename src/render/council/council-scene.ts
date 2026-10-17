import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import robotUrl from '../../../assets/robot/RobotExpressive.glb?url';
import { COUNCIL_ROLES, type CouncilRole, type Consequences, type VillagePumpDesignId } from '../../genlayer/council/types';
import { CouncilActor } from './council-actor';
import { Creek, IslandGround, Sea, creekZ, fbm, groundHeight } from './terrain';
import { PumpSite, PUMP_X, PUMP_Z, SITE_FOCUS } from './pump-site';
import { Campfire, type FireMood } from './campfire';
export type { FireMood } from './campfire';

const mat = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra });

export type Shot = 'site' | 'council' | 'verdict' | 'wide' | { speaker: CouncilRole };

const SEAT_RADIUS = 2.15;
/** A half-circle on the far side of the fire, open toward the camera and the pump. */
const SEAT_ANGLE: Record<CouncilRole, number> = { fisher: -1.25, farmer: -2.3, engineer: 1.65, elder: 2.75 };
const OPEN_ANGLE = 0.2;

function palm(seed: number): THREE.Group {
  const g = new THREE.Group();
  const segs = 6, lean = 0.18 + (seed % 3) * 0.06;
  let y = 0, x = 0;
  for (let i = 0; i < segs; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.14 - i * 0.012, 0.17 - i * 0.012, 0.6, 6), mat(i % 2 ? 0x9b7b52 : 0x8a6a45));
    seg.position.set(x, y + 0.3, 0); seg.rotation.z = -lean;
    g.add(seg); y += 0.57; x += Math.sin(lean) * 0.6;
  }
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.0, 4, 1).translate(0, 1.0, 0).scale(1, 1, 0.25), mat(i % 2 ? 0x4f9a46 : 0x62ad4f));
    leaf.position.set(x, y, 0);
    leaf.rotation.set(0, (i / 7) * Math.PI * 2 + seed, 1.15 + (i % 3) * 0.15);
    leaf.rotation.order = 'YZX';
    g.add(leaf);
  }
  const nut = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), mat(0x5c4128));
  nut.position.set(x + 0.1, y - 0.15, 0.1); g.add(nut);
  return g;
}

function roundTree(seed: number): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.4, 6), mat(0x6e4d30));
  trunk.position.y = 0.7; g.add(trunk);
  const greens = [0x3f7f3e, 0x4b8f43, 0x5ea24e];
  for (let i = 0; i < 3; i++) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75 - i * 0.12, 0), mat(greens[(seed + i) % 3]!));
    blob.position.set(Math.sin(seed + i * 2) * 0.3, 1.6 + i * 0.45, Math.cos(seed + i * 2) * 0.3);
    blob.rotation.set(seed, i, 0); g.add(blob);
  }
  return g;
}

function hut(roof: number): THREE.Group {
  const g = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 1.7), mat(0xf0e2c4));
  walls.position.y = 0.7;
  const top = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.2, 4), mat(roof));
  top.position.y = 2.0; top.rotation.y = Math.PI / 4;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.85, 0.05), mat(0x6e4d30));
  door.position.set(0.3, 0.43, 0.86);
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.05), new THREE.MeshStandardMaterial({ color: 0xffc46b, emissive: 0xffa53d, emissiveIntensity: 1.6 }));
  win.position.set(-0.45, 0.85, 0.86);
  g.add(walls, top, door, win);
  return g;
}

function rock(seed: number, size: number): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(size, 0);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.8 + fbm(i, seed) * 0.5), p.getY(i) * 0.6, p.getZ(i) * (0.8 + fbm(seed, i) * 0.5));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat(0x8f8b80));
}

function sky(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(200, 32, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x3b4f86) }, mid: { value: new THREE.Color(0xf0a77a) }, low: { value: new THREE.Color(0xffd9a0) },
      sun: { value: new THREE.Vector3(-0.85, 0.16, 0.5).normalize() },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform vec3 sun; varying vec3 vDir;
      void main(){ float h = vDir.y; vec3 c = mix(low, mid, smoothstep(-0.02, 0.12, h)); c = mix(c, top, smoothstep(0.1, 0.6, h));
      float s = max(dot(normalize(vDir), sun), 0.0); c += vec3(1.0,0.75,0.45) * pow(s, 64.0) * 1.2 + vec3(1.0,0.6,0.35) * pow(s, 6.0) * 0.25;
      gl_FragColor = vec4(c, 1.0); }`,
  });
  return new THREE.Mesh(geo, material);
}

/**
 * Isolated village-pump council diorama. It renders whatever display state it is
 * told to; it has no access to the World, saves, wallets or approval evidence.
 */
export class CouncilScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  readonly actors = new Map<CouncilRole, CouncilActor>();
  readonly site = new PumpSite();
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly fire = new Campfire();
  private readonly ground: IslandGround;
  private readonly sea: Sea;
  private readonly creek: Creek;
  private readonly clock = new THREE.Clock();
  private readonly camPos = new THREE.Vector3(9, 7, 13);
  private readonly camLook = new THREE.Vector3(1, 0.5, -1);
  private readonly wantPos = new THREE.Vector3();
  private readonly wantLook = new THREE.Vector3();
  private shot: Shot = 'wide';
  private orbit = 0;
  private lush = 0.35;
  private sun!: THREE.DirectionalLight;
  private readonly hemi = new THREE.HemisphereLight(0xffd7b0, 0x3d5a63, 1.1);
  private readonly fogStorm = new THREE.Color(0xb7a99c);
  private readonly fogCalm = new THREE.Color(0xe9b48e);
  onFrame: ((dt: number) => void) | null = null;

  static async create(host: HTMLElement): Promise<CouncilScene> {
    const robot = await new GLTFLoader().loadAsync(robotUrl);
    return new CouncilScene(host, robot);
  }

  private constructor(private readonly host: HTMLElement, robot: GLTF) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    host.appendChild(this.renderer.domElement);

    const s = this.scene;
    s.fog = new THREE.Fog(0xe9b48e, 30, 110);
    s.add(sky());
    s.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xffc48a, 2.4);
    sun.position.set(-20, 10, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 70 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    s.add(sun);
    const rim = new THREE.DirectionalLight(0x8fb8ff, 0.6);
    rim.position.set(14, 8, 12);
    s.add(rim);

    this.ground = new IslandGround({
      grass: new THREE.Color(0x5daa45), grassDry: new THREE.Color(0xb39a62), sand: new THREE.Color(0xecd3a0),
      mud: new THREE.Color(0x7a6448), rock: new THREE.Color(0x8f8b80),
    });
    s.add(this.ground.mesh);
    this.sea = new Sea(new THREE.Color(0x2f8ea0));
    s.add(this.sea.group);
    this.creek = new Creek(new THREE.Color(0x4fb5c8));
    s.add(this.creek.mesh);
    this.fire.group.position.y = groundHeight(0, 0);
    s.add(this.fire.group);
    s.add(this.site.group);
    this.decorate();

    for (const role of COUNCIL_ROLES) {
      const actor = new CouncilActor(robot, role);
      const a = SEAT_ANGLE[role];
      const x = Math.cos(a) * SEAT_RADIUS, z = Math.sin(a) * SEAT_RADIUS;
      actor.root.position.set(x, groundHeight(x, z), z);
      actor.root.lookAt(0, actor.root.position.y, 0);
      const mat2 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.06, 10), mat(0xa4472e));
      mat2.position.set(x, groundHeight(x, z) + 0.03, z); mat2.receiveShadow = true;
      s.add(mat2, actor.root);
      this.actors.set(role, actor);
    }

    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(s, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.5, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.setShot('wide', true);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private decorate(): void {
    const s = this.scene;
    const place = (o: THREE.Object3D, x: number, z: number, ry = 0) => {
      o.position.set(x, groundHeight(x, z), z); o.rotation.y = ry;
      o.traverse(c => { if (c instanceof THREE.Mesh) { c.castShadow = true; c.receiveShadow = true; } });
      s.add(o);
    };
    const palms: [number, number][] = [[-9, 3], [-11, -1], [-6, 9.5], [13, 1.5], [12, -3], [-12.5, -6], [-1, 12.5], [-5.5, 12.5], [-3, -11.5], [11, -9]];
    palms.forEach(([x, z], i) => place(palm(i), x, z, i * 1.7));
    const trees: [number, number][] = [[-6.5, 4.8], [-8.5, 7], [-4.5, 7.2], [-10.5, 4.2], [7, -11], [-7, -10.5], [-1, -10.2], [-12, 2]];
    trees.forEach(([x, z], i) => { const t = roundTree(i); t.scale.setScalar(0.9 + (i % 3) * 0.2); place(t, x, z, i); });
    place(hut(0xb4553a), -9.2, 0.2, 1.3);
    place(hut(0x3e7d8c), -7.8, -3.4, 0.9);
    for (let i = 0; i < 18; i++) {
      const a = i * 2.4, r = 6 + (i % 5) * 1.6;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(z - creekZ(x)) < 2.2 || Math.hypot(x - PUMP_X, z - PUMP_Z) < 3) continue;
      const rk = rock(i, 0.25 + (i % 4) * 0.12);
      place(rk, x, z, i);
    }
    // Lanterns mark the path from the clearing to the pump.
    for (const [x, z] of [[3.6, 1.2], [5.4, -1.0], [-3.6, -1.6]] as const) {
      const post = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.4, 5), mat(0x5a3a22)); pole.position.y = 0.7;
      const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xffb14a, emissiveIntensity: 2.4 }));
      lamp.position.y = 1.45;
      const glow = new THREE.PointLight(0xffb14a, 2.2, 4, 2); glow.position.y = 1.45;
      post.add(pole, lamp, glow);
      place(post, x, z);
    }
    // Stepping stones across the creek to the nesting beach.
    for (let i = 0; i < 4; i++) {
      const x = PUMP_X - 2.6 + i * 0.15, z = creekZ(x) - 1 + i * 0.7;
      const st = rock(40 + i, 0.28);
      st.scale.y = 0.4; place(st, x, z);
    }
  }

  private resize(): void {
    const w = this.host.clientWidth || window.innerWidth, h = this.host.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
    this.camera.aspect = w / h;
    // Keep the council framed on narrow phones by widening the lens.
    this.camera.fov = w / h < 1.2 ? 52 : 38;
    this.camera.updateProjectionMatrix();
  }

  setShot(shot: Shot, instant = false): void {
    this.shot = shot;
    this.shotTarget();
    if (instant) { this.camPos.copy(this.wantPos); this.camLook.copy(this.wantLook); }
  }

  private shotTarget(): void {
    const shot = this.shot;
    if (shot === 'site') { // Frame the site in the left of the view; the plan panel sits on the right.
      const wide = this.camera.aspect > 1.2;
      this.wantPos.set(SITE_FOCUS.x + 3.5, 6.5, SITE_FOCUS.z + 10.5);
      this.wantLook.copy(SITE_FOCUS).setY(-0.2);
      if (wide) this.wantLook.add(new THREE.Vector3(10.5, 0, -3.5).normalize().multiplyScalar(2.6));
      else this.wantLook.y -= 2.2; }
    else if (shot === 'council') {
      const a = 0.9 + Math.sin(this.orbit * 0.12) * 0.5;
      this.wantPos.set(Math.cos(a) * 7.5, 3.6, Math.sin(a) * 7.5 + 1); this.wantLook.set(0, 0.8, 0);
    } else if (shot === 'verdict') { this.wantPos.set(-3.5, 7.5, 9.5); this.wantLook.set(2.6, 0.4, -2.6); }
    else if (shot === 'wide') {
      const a = 0.7 + this.orbit * 0.04;
      this.wantPos.set(Math.cos(a) * 15, 9, Math.sin(a) * 15); this.wantLook.set(1.5, 0.3, -1.5);
    } else {
      // Shoot from the open side of the half-circle, moving partway toward the speaker.
      const p = this.actors.get(shot.speaker)!.root.position;
      const base = new THREE.Vector3(Math.cos(OPEN_ANGLE) * 5, 0, Math.sin(OPEN_ANGLE) * 5);
      this.wantPos.copy(base).lerp(new THREE.Vector3(p.x, 0, p.z), 0.4).setY(p.y + 1.9);
      this.wantLook.copy(p).setY(p.y + 0.95);
    }
  }

  setFire(mood: FireMood): void { this.fire.setMood(mood); }

  /** Diorama view: broken baseline, a chosen design, and (when supplied) consequences. */
  showSite(design: VillagePumpDesignId | null, consequences: Consequences | null, instant = false): void {
    this.site.setView({ design, consequences }, instant);
  }

  /** Screen position (px) of a point above an actor's head, or null if behind the camera. */
  bubblePosition(role: CouncilRole): { x: number; y: number } | null {
    const actor = this.actors.get(role)!;
    const v = new THREE.Vector3();
    actor.root.updateWorldMatrix(true, true);
    actor.root.getWorldPosition(v);
    v.y += actor.seated ? 1.35 : 2.0;
    v.project(this.camera);
    if (v.z > 1) return null;
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: (v.x * 0.5 + 0.5) * r.width + r.left, y: (-v.y * 0.5 + 0.5) * r.height + r.top };
  }

  private frame(): void {
    const dt = Math.min(this.clock.getDelta(), 0.1), t = this.clock.elapsedTime;
    this.orbit += dt;
    this.shotTarget();
    const k = 1 - Math.exp(-dt * 2.2);
    this.camPos.lerp(this.wantPos, k);
    this.camLook.lerp(this.wantLook, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.sea.update(t);
    this.fire.update(dt, t);
    this.site.update(dt, t);
    this.creek.setLevel(-0.32 + this.site.waterLevel * 0.42);
    this.creek.update(dt, t);
    const lush = 0.15 + this.site.habitatLevel * 0.85;
    if (Math.abs(lush - this.lush) > 0.004) { this.lush += (lush - this.lush) * Math.min(1, dt * 2); this.ground.setLushness(this.lush); }
    // Storm-subdued light warms as the site recovers.
    const calm = THREE.MathUtils.clamp((this.site.waterLevel + this.site.habitatLevel) / 2, 0, 1);
    this.sun.intensity = 1.7 + calm * 1.1;
    this.hemi.intensity = 0.9 + calm * 0.35;
    (this.scene.fog as THREE.Fog).color.copy(this.fogStorm).lerp(this.fogCalm, calm);
    this.renderer.toneMappingExposure = 0.95 + calm * 0.15;
    for (const actor of this.actors.values()) actor.update(dt);
    this.onFrame?.(dt);
    this.composer.render();
  }
}
