import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { CouncilRole, Stance } from '../../genlayer/council/types';

/** Island priorities, drawn as members of the hero's robot family. Not validators. */
export const ROLE_LOOK: Record<CouncilRole, { body: number; accent: number }> = {
  fisher: { body: 0x2f8fa3, accent: 0xf2c14e },
  farmer: { body: 0xd9a53f, accent: 0x6e8f3a },
  engineer: { body: 0xd9653b, accent: 0xf4e4b8 },
  elder: { body: 0x8a76b8, accent: 0xefe6d2 },
};

type Pose = 'seated' | 'standing' | 'supports' | 'mixed' | 'concerned' | 'walking' | 'lying' | 'voting';
const flat = (color: number) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8 });

function accessory(role: CouncilRole, look: Readonly<{ body: number; accent: number }> = ROLE_LOOK[role]): { head: THREE.Object3D; hand: THREE.Object3D | null } {
  const { accent, body } = look;
  const head = new THREE.Group(), add = (m: THREE.Mesh) => { m.castShadow = true; head.add(m); return m; };
  if (role === 'fisher') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 0.06, 10), flat(accent))).position.y = 0;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.2, 10), flat(accent))).position.y = 0.12;
  } else if (role === 'farmer') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.62, 0.3, 12), flat(0xe8cf86))).position.y = 0.12;
    add(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 6, 14).rotateX(Math.PI / 2), flat(0xa4472e))).position.y = 0.04;
  } else if (role === 'engineer') {
    const dome = add(new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), flat(0xf3c623)));
    dome.position.y = 0.02;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 12), flat(0xf3c623))).position.set(0, 0.02, 0.06);
  } else {
    add(new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.07, 6, 14).rotateX(Math.PI / 2), flat(accent))).position.y = -0.42;
    add(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 6), flat(accent))).position.set(0, -0.6, 0.18);
  }
  let hand: THREE.Object3D | null = null;
  if (role === 'fisher') {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 1.6, 5), flat(0x6b4a2b));
    rod.rotation.x = 0.4; rod.position.y = 0.6; hand = rod;
  } else if (role === 'engineer') {
    const wrench = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.04), flat(0xb8c1c6));
    const jaw = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 4, 8, Math.PI * 1.4), flat(0xb8c1c6));
    jaw.position.y = 0.25; wrench.add(shaft, jaw); hand = wrench;
  } else if (role === 'elder') {
    const cane = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6), flat(0x5b3d24));
    cane.position.y = -0.35; hand = cane;
  } else {
    const sprout = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 4), flat(0x4f7a2a));
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), flat(body === 0 ? 0 : 0x7fb24a));
    leaf.scale.set(1, 0.5, 1.4); leaf.position.y = 0.17; sprout.add(stem, leaf); sprout.position.y = 0.12; hand = sprout;
  }
  return { head, hand };
}

export class CouncilActor {
  readonly root = new THREE.Group();
  readonly role: CouncilRole;
  private readonly skin: THREE.Object3D;
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private face: THREE.Mesh | null = null;
  private faceTarget: Record<string, number> = { Angry: 0, Surprised: 0, Sad: 0 };
  private readonly headBone: THREE.Object3D | null;
  private pose: Pose = 'standing';
  /** World-space anchor above the head for speech bubbles. */
  readonly bubbleAnchor = new THREE.Object3D();

  constructor(source: GLTF, role: CouncilRole, look: Readonly<{ body: number; accent: number }> = ROLE_LOOK[role], withHand = true) {
    this.role = role;
    this.root.name = `council-${role}`;
    this.skin = clone(source.scene);
    this.root.add(this.skin);
    this.skin.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true; object.receiveShadow = true;
      const mats = (Array.isArray(object.material) ? object.material : [object.material]).map(m => {
        const copy = m.clone() as THREE.MeshStandardMaterial;
        if (copy.name === 'Main') copy.color.setHex(look.body);
        if (copy.name === 'Grey') copy.color.setHex(0xd8d2c4);
        copy.roughness = 0.6; copy.metalness = 0.05;
        return copy;
      });
      object.material = Array.isArray(object.material) ? mats : mats[0];
      if (object.morphTargetDictionary && 'Sad' in object.morphTargetDictionary) this.face = object;
    });
    this.mixer = new THREE.AnimationMixer(this.skin);
    for (const clip of source.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
    for (const name of ['Sitting', 'Standing', 'Yes', 'No', 'ThumbsUp', 'Wave', 'Death', 'Jump']) {
      const a = this.actions.get(name);
      if (a) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    }
    this.mixer.update(0);
    this.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(this.skin);
    const scale = 1.55 / (bounds.max.y - bounds.min.y);
    this.skin.scale.multiplyScalar(scale);
    this.skin.position.y -= bounds.min.y * scale;
    this.headBone = this.skin.getObjectByName('Head') ?? null;
    const { head, hand } = accessory(role, look);
    if (this.headBone) {
      this.headBone.updateWorldMatrix(true, false);
      head.scale.divideScalar(this.headBone.getWorldScale(new THREE.Vector3()).x);
      head.position.y = (role === 'elder' ? 0.55 : 1.05) / this.headBone.getWorldScale(new THREE.Vector3()).x * 0.62;
      this.headBone.add(head);
      this.headBone.add(this.bubbleAnchor);
      this.bubbleAnchor.position.y = head.position.y * 1.9;
    }
    const palm = this.skin.getObjectByName('Palm1.R') ?? this.skin.getObjectByName('Palm1R');
    if (hand && palm && withHand) {
      palm.updateWorldMatrix(true, false);
      hand.scale.divideScalar(palm.getWorldScale(new THREE.Vector3()).x);
      hand.position.multiplyScalar(1 / palm.getWorldScale(new THREE.Vector3()).x);
      palm.add(hand);
    }
    this.play('Idle', 0);
  }

  private play(name: string, fade = 0.3, timeScale = 1): void {
    const next = this.actions.get(name);
    if (!next || next === this.current) return;
    next.reset().setEffectiveTimeScale(timeScale).setEffectiveWeight(1).play();
    if (this.current) this.current.crossFadeTo(next, fade, false);
    this.current = next;
  }

  /** Seated around the fire while the council has no verified decision. */
  sit(instant = false): void {
    if (this.pose === 'seated') return;
    this.pose = 'seated';
    this.play('Sitting', instant ? 0 : 0.4);
    if (instant && this.current) { this.current.time = this.current.getClip().duration; this.mixer.update(0); }
    this.setFace({});
  }

  stand(): void {
    if (this.pose !== 'seated') { this.play('Idle'); this.setFace({}); this.pose = 'standing'; return; }
    this.pose = 'standing';
    this.play('Standing', 0.25);
    this.setFace({});
  }

  /** Reaction to the verified stance for this island priority. */
  react(stance: Stance): void {
    this.pose = stance;
    if (stance === 'supports') { this.play('ThumbsUp', 0.25); this.setFace({}); }
    else if (stance === 'concerned') { this.play('No', 0.25, 0.8); this.setFace({ Sad: 0.75 }); }
    else { this.play('Yes', 0.25, 0.55); this.setFace({ Surprised: 0.35, Sad: 0.25 }); }
  }

  /** Walking loop (the caller moves the root). */
  walk(): void { if (this.pose === 'walking') return; this.pose = 'walking'; this.play('Walking', 0.3); this.setFace({}); }
  /** Lying on the back (the fall clip held on its last frame), for sunbathing. */
  lie(instant = false): void {
    if (this.pose === 'lying') return;
    this.pose = 'lying';
    this.play('Death', instant ? 0 : 0.4, instant ? 1 : 0.6);
    if (instant && this.current) { this.current.time = this.current.getClip().duration; this.mixer.update(0); }
    this.setFace({});
  }
  /** A validator's real vote as a gesture: nod to agree, head shake to disagree, wave for the leader. */
  vote(kind: 'leader' | 'agree' | 'disagree' | 'timeout'): void {
    this.pose = 'voting';
    if (kind === 'leader') { this.play('Wave', 0.25); this.setFace({}); }
    else if (kind === 'agree') { this.play('Yes', 0.25, 0.8); this.setFace({}); }
    else if (kind === 'disagree') { this.play('No', 0.25, 0.8); this.setFace({ Sad: 0.6 }); }
    else { this.play('Idle', 0.3); this.setFace({ Surprised: 0.5 }); }
  }

  /** Hold the reaction as a resting pose after the gesture finishes. */
  settle(): void {
    if (this.pose === 'seated') return;
    this.play('Idle', 0.5);
  }

  setFace(weights: Partial<Record<'Angry' | 'Surprised' | 'Sad', number>>): void {
    this.faceTarget = { Angry: weights.Angry ?? 0, Surprised: weights.Surprised ?? 0, Sad: weights.Sad ?? 0 };
  }

  get seated(): boolean { return this.pose === 'seated'; }
  get gestureDone(): boolean { return !this.current || !this.current.isRunning() || this.current.loop === THREE.LoopRepeat; }

  update(dt: number): void {
    this.mixer.update(Math.min(dt, 0.1));
    const face = this.face;
    if (face?.morphTargetDictionary && face.morphTargetInfluences) {
      for (const [k, v] of Object.entries(this.faceTarget)) {
        const i = face.morphTargetDictionary[k];
        if (i !== undefined) face.morphTargetInfluences[i]! += (v - face.morphTargetInfluences[i]!) * Math.min(1, dt * 6);
      }
    }
  }
}
