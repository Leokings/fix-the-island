import * as THREE from 'three';
import { COMMONS, groundHeight } from '../../content/stylized-island';
import { Campfire, type FireMood } from '../council/campfire';

// Presentation only: the living fire at the commons. It has no access to the World,
// saves, wallets or approval evidence.

export class CouncilCircle {
  readonly group = new THREE.Group();
  readonly fire = new Campfire(false);
  readonly centre: THREE.Vector3;

  constructor() {
    this.group.name = 'council-circle';
    const y = groundHeight(COMMONS.x, COMMONS.z);
    this.centre = new THREE.Vector3(COMMONS.x, y, COMMONS.z);
    // The baked fire pit already has its stones and logs; this adds the living fire.
    // The Spring Pump's council keeps two of its members seated here (site-councils.ts).
    this.fire.group.position.copy(this.centre);
    this.fire.light.intensity = 6;
    this.fire.light.castShadow = false;
    this.group.add(this.fire.group);
  }

  setFire(mood: FireMood): void { this.fire.setMood(mood); }

  update(dt: number, seconds: number): void { this.fire.update(dt, seconds); }
}
