import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { CouncilRole } from '../../genlayer/council/types';
import type { Obstacle } from '../../domain/terrain';
import { COMMONS, COUNCIL_SEATS, HOUSES, PAD_RADIUS, PIER, SITE_ANCHORS, SPAWN, creekInfo, groundHeight, isWet, pathDistance, rand } from '../../content/stylized-island';
import { CouncilActor } from '../council/council-actor';

// Presentation only. Each repair site has its own council of five, one figure per
// validator seat in a StudioNet review (one leader, four validators). Between
// reviews they go about island life near their site. When a review finalizes, the
// reveal drives them from the transaction's real votes; idle validators simply
// carry on with what they were doing. Nothing here can grant or change progress.

export type Activity = 'fish' | 'sunbathe' | 'walk' | 'sit' | 'tinker';
export const COUNCIL_SIZE = 5;

/** Slot 0 is the leader's seat (working by the machine); the rest suit the place. */
const PLAN: Readonly<Record<string, readonly Activity[]>> = {
  pier_hoist: ['tinker', 'fish', 'fish', 'sunbathe', 'walk'],
  village_pump: ['tinker', 'sit', 'sit', 'walk', 'sit'],
  tidal_sluice: ['tinker', 'fish', 'fish', 'walk', 'sit'],
  creek_bridge: ['tinker', 'fish', 'walk', 'sit', 'sunbathe'],
  coast_windmill: ['tinker', 'walk', 'sit', 'sit', 'walk'],
  woodland_pathlight: ['tinker', 'walk', 'sit', 'walk', 'sit'],
  upland_waterworks: ['tinker', 'sit', 'walk', 'sunbathe', 'sit'],
  ridge_beacon: ['tinker', 'sit', 'walk', 'sit', 'sunbathe'],
};
// Hats and tools vary by seat so a council does not read as one crowd of straw hats.
const ACCESSORY: Record<Activity, readonly CouncilRole[]> = { fish: ['fisher'], sunbathe: ['farmer'], walk: ['elder', 'farmer'], sit: ['elder', 'farmer'], tinker: ['engineer'] };
const HAND: Record<Activity, boolean> = { fish: true, sunbathe: false, walk: true, sit: false, tinker: true };
const PALETTE: readonly Readonly<{ body: number; accent: number }>[] = [
  { body: 0xd9653b, accent: 0xf4e4b8 }, { body: 0x2f8fa3, accent: 0xf2c14e }, { body: 0x8a76b8, accent: 0xefe6d2 },
  { body: 0xd9a53f, accent: 0x6e8f3a }, { body: 0x5f9e6e, accent: 0xf0d7a1 }, { body: 0xc95f84, accent: 0xf6e3c0 },
  { body: 0x4f6fb0, accent: 0xf2c14e },
];

interface Spot { x: number; z: number; facing: number; activity: Activity; to?: { x: number; z: number } }

const canvasMaterials = [0x2f8fa3, 0xd9653b, 0x5f9e6e].map(color => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 }));
const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x9a6b3f, flatShading: true, roughness: 0.9 });
const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x9a9286, flatShading: true, roughness: 0.95 });
const barkMaterial = new THREE.MeshStandardMaterial({ color: 0x7a5232, flatShading: true, roughness: 0.95 });

function nearObstacle(obstacles: readonly Obstacle[], x: number, z: number, margin: number): boolean {
  return obstacles.some(o => {
    const m = /^decor:(pine|tree)/.test(o.id) ? margin + 1.1 : /^decor:palm/.test(o.id) ? margin + 0.6 : margin;
    return x > o.minX - m && x < o.maxX + m && z > o.minZ - m && z < o.maxZ + m;
  });
}
/** In or right beside the creek's channel (its banks read as water even where the ground test is dry). */
function inCreek(x: number, z: number, margin = 0.7): boolean {
  const c = creekInfo({ x, z });
  return c.d < c.w / 2 + margin;
}
function slope(x: number, z: number): number {
  const h = groundHeight(x, z);
  return Math.max(...[[0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]].map(([dx, dz]) => Math.abs(groundHeight(x + dx!, z + dz!) - h))) / 0.4;
}
/** Direction toward water within reach, for a fisher; null when none. */
function waterFacing(x: number, z: number): number | null {
  let best: number | null = null, bestDistance = Infinity;
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2;
    for (const reach of [0.9, 1.3, 1.7]) {
      if (isWet(x + Math.sin(a) * reach, z + Math.cos(a) * reach)) { if (reach < bestDistance) { bestDistance = reach; best = a; } break; }
    }
  }
  return best;
}

/** True near a drop: any ground within 1 m sits more than 0.6 m lower (cliff edges read as precarious). */
function nearDrop(x: number, z: number): boolean {
  const h = groundHeight(x, z);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; if (h - groundHeight(x + Math.sin(a), z + Math.cos(a)) > 0.6) return true; }
  return false;
}

function standable(obstacles: readonly Obstacle[], taken: readonly { x: number; z: number }[], x: number, z: number, siteId: string, clearPath = 0.9, fishing = false): boolean {
  if (isWet(x, z) || slope(x, z) > 0.55 || inCreek(x, z, fishing ? 0.25 : 0.7)) return false;
  // Stay on the site's own level, where the council can be seen with it; fishers may go down to the water.
  const site = SITE_ANCHORS[siteId]!, rise = groundHeight(x, z) - groundHeight(site.x, site.z);
  if (rise > 1.5 || rise < (fishing ? -4 : -1.5)) return false;
  if (!fishing && nearDrop(x, z)) return false;
  if (pathDistance({ x, z }) < clearPath) return false;
  if (nearObstacle(obstacles, x, z, 0.45)) return false;
  for (const [id, anchor] of Object.entries(SITE_ANCHORS)) if (Math.hypot(x - anchor.x, z - anchor.z) < (PAD_RADIUS[id] ?? 4.5) * (id === siteId ? 0.62 : 1) + 0.3) return false;
  if (HOUSES.some(h => Math.hypot(x - h.x, z - h.z) < 3.2)) return false;
  if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 2.6) return false;
  if (Math.abs(x - PIER.x) < PIER.halfWidth + 0.4 && z > PIER.fromZ - 0.5 && z < PIER.toZ + 0.5) return false;
  return !taken.some(t => Math.hypot(t.x - x, t.z - z) < 1.7);
}

/** Deterministic spots around a site: same island, same council places, every load. */
export function councilSpots(siteId: string, obstacles: readonly Obstacle[], others: readonly { x: number; z: number }[] = []): Spot[] {
  const anchor = SITE_ANCHORS[siteId]!, plan = PLAN[siteId]!, pad = PAD_RADIUS[siteId] ?? 4.5;
  const taken: Spot[] = [];
  // Members of other councils count too, with more room, so neighbouring councils never bunch up.
  const crowded = (x: number, z: number) => others.some(o => Math.hypot(o.x - x, o.z - z) < 2.4);
  // The pump's council keeps two seats at the commons fire.
  const fireSeats = siteId === 'village_pump' ? [COUNCIL_SEATS.fisher, COUNCIL_SEATS.elder] : [];
  plan.forEach((activity, slot) => {
    if (activity === 'sit' && fireSeats.length) {
      const seat = fireSeats.shift()!;
      taken.push({ x: seat.x, z: seat.z, facing: Math.atan2(COMMONS.x - seat.x, COMMONS.z - seat.z), activity });
      return;
    }
    const near = activity === 'tinker' ? [pad * 0.7, pad * 0.95] : [pad * 0.95, pad + 3.2];
    for (let attempt = 0; attempt < 400; attempt++) {
      const a = rand(slot * 13.1 + attempt * 0.37, siteId.length * 7.7 + attempt) * Math.PI * 2;
      const r = near[0]! + rand(attempt * 1.91 + slot, siteId.charCodeAt(0) + attempt * 0.13) * (near[1]! - near[0]!) + (attempt > 200 ? 2 : 0);
      const x = anchor.x + Math.sin(a) * r, z = anchor.z + Math.cos(a) * r;
      if (activity === 'tinker') {
        // The leader works at the pad's edge, facing the machine.
        if (!standable(obstacles, taken, x, z, siteId, 0.6) || crowded(x, z)) continue;
        taken.push({ x, z, facing: Math.atan2(anchor.x - x, anchor.z - z), activity }); return;
      }
      if (!standable(obstacles, taken, x, z, siteId, 0.9, activity === 'fish') || crowded(x, z)) continue;
      if (activity === 'fish') {
        const facing = waterFacing(x, z);
        if (facing === null) continue;
        taken.push({ x, z, facing, activity }); return;
      }
      if (activity === 'walk') {
        const heading = rand(x, z) * Math.PI * 2, length = 1.6 + rand(z, x) * 1.2;
        const to = { x: x + Math.sin(heading) * length, z: z + Math.cos(heading) * length };
        const steps = Math.ceil(length / 0.3);
        const clear = Array.from({ length: steps }, (_, k) => (k + 1) / steps).every(t => { const px = x + (to.x - x) * t, pz = z + (to.z - z) * t; return standable(obstacles, taken, px, pz, siteId, 0.6) && !crowded(px, pz); });
        if (!clear) continue;
        taken.push({ x, z, facing: heading, activity, to }); return;
      }
      if (activity === 'sunbathe' && slope(x, z) > 0.25) continue;
      // Sitting and sunbathing face the view: away from the site.
      taken.push({ x, z, facing: Math.atan2(x - anchor.x, z - anchor.z), activity }); return;
    }
    // Nowhere suitable for that activity: sit at a checked spot nearby instead.
    for (let attempt = 0; attempt < 600; attempt++) {
      const a = rand(slot * 3.7 + attempt * 0.53, attempt * 1.3 + 9) * Math.PI * 2, r = pad * 0.75 + rand(attempt * 2.1, slot + 4.4) * 5;
      const x = anchor.x + Math.sin(a) * r, z = anchor.z + Math.cos(a) * r;
      if (!standable(obstacles, taken, x, z, siteId, 0.5)) continue;
      taken.push({ x, z, facing: Math.atan2(x - anchor.x, z - anchor.z), activity: 'sit' }); return;
    }
    // Last resort (never hit on the shipped island): stand at the pad edge facing the machine.
    const a = slot * 1.3, x = anchor.x + Math.sin(a) * (pad + 1), z = anchor.z + Math.cos(a) * (pad + 1);
    taken.push({ x, z, facing: Math.atan2(anchor.x - x, anchor.z - z), activity: 'tinker' });
  });
  return taken;
}

function prop(activity: Activity, i: number): THREE.Object3D | null {
  if (activity === 'sunbathe') {
    // A deck chair under the sitting pose: seat at hip height, canvas back leaning away.
    const chair = new THREE.Group(); chair.name = 'council-deckchair'; chair.position.set(0, 0, -0.2);
    const canvas = canvasMaterials[i % canvasMaterials.length]!;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.46), canvas); seat.position.set(0, 0.2, 0); chair.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.62), canvas); back.position.set(0, 0.45, -0.45); back.rotation.x = 1.05; chair.add(back);
    for (const sx of [-0.27, 0.27]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.9), woodMaterial); rail.position.set(sx, 0.2, -0.12); rail.rotation.x = 0.18; chair.add(rail);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.04), woodMaterial); leg.position.set(sx, 0.1, 0.2); chair.add(leg);
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.62, 0.04), woodMaterial); strut.position.set(sx, 0.28, -0.6); strut.rotation.x = 0.55; chair.add(strut);
    }
    chair.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    return chair;
  }
  if (activity === 'sit' || activity === 'fish') {
    const g = new THREE.Group(); g.name = 'council-seat'; g.position.set(0, 0.06, -0.21);
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), i % 2 ? stoneMaterial : barkMaterial);
    stone.scale.set(1.5, 0.55, 1.1); stone.castShadow = stone.receiveShadow = true; g.add(stone); return g;
  }
  return null;
}

export class SiteCouncil {
  readonly group = new THREE.Group();
  readonly actors: CouncilActor[] = [];
  readonly spots: readonly Spot[];
  private readonly engaged: boolean[] = [];
  private readonly walkT: number[] = [];
  private readonly faceTo: (number | null)[] = [];

  constructor(robot: GLTF, readonly siteId: string, obstacles: readonly Obstacle[], paletteOffset: number, others: readonly { x: number; z: number }[] = []) {
    this.group.name = `site-council-${siteId}`;
    this.spots = councilSpots(siteId, obstacles, others);
    this.spots.forEach((spot, i) => {
      const kinds = ACCESSORY[spot.activity];
      const actor = new CouncilActor(robot, kinds[(i + paletteOffset) % kinds.length]!, PALETTE[(i + paletteOffset) % PALETTE.length]!, HAND[spot.activity]);
      actor.root.name = `council-${siteId}-${i}`;
      actor.root.position.set(spot.x, groundHeight(spot.x, spot.z) + (spot.activity === 'sit' ? 0.04 : 0), spot.z);
      actor.root.rotation.y = spot.facing;
      // A sunbather's towel stays put in the world; a sitter's stone sits under the hips.
      const extra = prop(spot.activity, i);
      if (extra) actor.root.add(extra);
      this.group.add(actor.root);
      this.actors.push(actor);
      this.engaged.push(false); this.walkT.push(rand(i, spot.x)); this.faceTo.push(null);
      this.rest(i, true);
    });
  }

  private rest(i: number, instant = false): void {
    const spot = this.spots[i]!, actor = this.actors[i]!;
    if (spot.activity === 'sit' || spot.activity === 'fish' || spot.activity === 'sunbathe') actor.sit(instant);
    else if (spot.activity === 'walk') actor.walk();
    else actor.stand();
  }

  /** Stop the activity, stand and turn toward a point (the restorer or the leader). */
  engage(i: number, toward: { x: number; z: number }): void {
    const actor = this.actors[i]!;
    this.engaged[i] = true;
    actor.stand();
    this.faceTo[i] = Math.atan2(toward.x - actor.root.position.x, toward.z - actor.root.position.z);
  }
  /** Back to fishing, walking or whatever they were doing. */
  release(i: number): void {
    if (!this.engaged[i]) return;
    this.engaged[i] = false; this.faceTo[i] = null;
    const spot = this.spots[i]!;
    if (spot.activity !== 'walk') this.actors[i]!.root.rotation.y = spot.facing;
    this.rest(i);
  }
  isEngaged(i: number): boolean { return this.engaged[i]!; }

  /** World point above a member's head. */
  head(i: number): THREE.Vector3 {
    const actor = this.actors[i]!;
    return actor.root.position.clone().add(new THREE.Vector3(0, actor.seated ? 1.35 : 2.0, 0));
  }
  centre(): THREE.Vector3 {
    const c = new THREE.Vector3();
    for (const actor of this.actors) c.add(actor.root.position);
    return c.divideScalar(this.actors.length);
  }

  private celebrateFor = 0;
  /** The island is restored: everyone stands, turns toward the view and waves, then carries on. */
  celebrate(toward: (p: THREE.Vector3) => { x: number; z: number }): void {
    this.actors.forEach((actor, i) => { this.engage(i, toward(actor.root.position)); actor.vote('leader'); });
    this.celebrateFor = 4.5;
  }

  update(dt: number): void {
    if (this.celebrateFor > 0) { this.celebrateFor -= dt; if (this.celebrateFor <= 0) this.actors.forEach((_, i) => this.release(i)); }
    this.actors.forEach((actor, i) => {
      const spot = this.spots[i]!;
      if (spot.activity === 'walk' && spot.to && !this.engaged[i]) {
        // Pace slowly back and forth along a short clear stretch.
        this.walkT[i] = (this.walkT[i]! + dt * 0.11) % 2;
        const t = this.walkT[i]!, u = t < 1 ? t : 2 - t, ease = u * u * (3 - 2 * u);
        const x = spot.x + (spot.to.x - spot.x) * ease, z = spot.z + (spot.to.z - spot.z) * ease;
        actor.root.position.set(x, groundHeight(x, z), z);
        actor.root.rotation.y = Math.atan2(spot.to.x - spot.x, spot.to.z - spot.z) + (t < 1 ? 0 : Math.PI);
      }
      const target = this.faceTo[i];
      if (target !== null && target !== undefined) {
        let d = target - actor.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
        actor.root.rotation.y += d * Math.min(1, dt * 5);
      }
      actor.update(dt);
    });
  }
}

/** All eight site councils. */
export class SiteCouncils {
  readonly group = new THREE.Group();
  readonly councils = new Map<string, SiteCouncil>();
  constructor(robot: GLTF, siteIds: readonly string[], obstacles: readonly Obstacle[], keepClear: readonly { x: number; z: number }[] = []) {
    this.group.name = 'site-councils';
    // Places other scenery needs (e.g. the windmill pads) count as taken.
    const everyone: { x: number; z: number }[] = [...keepClear];
    siteIds.forEach((siteId, n) => {
      if (!PLAN[siteId] || !SITE_ANCHORS[siteId]) return;
      const council = new SiteCouncil(robot, siteId, obstacles, n * 2, everyone);
      for (const spot of council.spots) { everyone.push(spot); if (spot.to) everyone.push(spot.to); }
      this.councils.set(siteId, council); this.group.add(council.group);
    });
  }
  /** Only councils near the view animate; far ones hold their pose (they are off screen or tiny). */
  update(dt: number, focus: { x: number; z: number } | null): void {
    for (const council of this.councils.values()) {
      const anchor = SITE_ANCHORS[council.siteId]!;
      if (!focus || Math.hypot(anchor.x - focus.x, anchor.z - focus.z) < 26) council.update(dt);
    }
  }
}
