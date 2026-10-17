import * as THREE from 'three';
import { SERVICE_BOARD } from '../../content/service-layout';
import { socketPosition } from '../../content/assembly-layout';
import { Kit, PUMP_PARTS, buildPumpPlatform, type PartBuilder } from './pump-machinery';
import { HOIST_PARTS, buildHoistPlatform } from './machines/hoist';
import { SLUICE_PARTS, buildSluicePlatform } from './machines/sluice';
import { WATERWORKS_PARTS, buildWaterworksPlatform } from './machines/waterworks';
import { BRIDGE_PARTS } from './machines/bridge';
import { WINDMILL_PARTS } from './machines/windmill';
import { BEACON_PARTS, PATHLIGHT_PARTS, buildElectricPlatform } from './machines/electric';

// Presentation only: authored machinery for each repair site. A site listed here
// draws its parts as models (storm-worn until installed) on its own platform;
// sites not listed yet keep the generic part shapes.

interface SiteMachine { readonly parts: Readonly<Record<string, PartBuilder>>; readonly platform?: () => THREE.Group }
const MACHINES: Readonly<Record<string, SiteMachine>> = {
  village_pump: { parts: PUMP_PARTS, platform: buildPumpPlatform },
  pier_hoist: { parts: HOIST_PARTS, platform: buildHoistPlatform },
  tidal_sluice: { parts: SLUICE_PARTS, platform: buildSluicePlatform },
  upland_waterworks: { parts: WATERWORKS_PARTS, platform: buildWaterworksPlatform },
  woodland_pathlight: { parts: PATHLIGHT_PARTS, platform: () => buildElectricPlatform('path') },
  creek_bridge: { parts: BRIDGE_PARTS },
  coast_windmill: { parts: WINDMILL_PARTS },
  ridge_beacon: { parts: BEACON_PARTS, platform: () => buildElectricPlatform('ridge') },
};
const PLATFORM_TOP = SERVICE_BOARD.y + SERVICE_BOARD.height / 2;

export const hasAuthoredMachine = (siteId: string): boolean => siteId in MACHINES;
export const buildSitePlatform = (siteId: string): THREE.Group | null => MACHINES[siteId]?.platform?.() ?? null;

/** The authored model for one slot, or null when the site (or slot) has none yet. */
export function buildSitePart(siteId: string, slot: string, facts: Readonly<Record<string, number | string>>, options: { worn: boolean }): THREE.Group | null {
  const build = MACHINES[siteId]?.parts[slot];
  if (!build) return null;
  const group = new THREE.Group();
  build(new Kit(group, options.worn), PLATFORM_TOP - socketPosition(siteId, slot).y, facts);
  if (options.worn) {
    // A storm-knocked machine: a slight lean, so the broken state reads at a glance.
    const s = (slot.length + siteId.length) * 12.9898;
    group.rotation.x = Math.sin(s) * 0.09;
    group.rotation.z = Math.cos(s * 1.7) * 0.14;
  }
  group.name = `site-part:${siteId}:${slot}`;
  return group;
}

const ghostDim = new THREE.MeshBasicMaterial({ color: 0x9fe6ff, transparent: true, opacity: 0.22, depthWrite: false });
const ghostBright = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.55, depthWrite: false });
/** Blueprint ghost of a part at its empty socket; the held part's ghost glows warm. */
export function ghostSitePart(siteId: string, slot: string, facts: Readonly<Record<string, number | string>>, held: boolean): THREE.Group | null {
  const part = buildSitePart(siteId, slot, facts, { worn: false });
  if (!part) return null;
  part.traverse(o => { if (o instanceof THREE.Mesh) { o.material = held ? ghostBright : ghostDim; o.castShadow = o.receiveShadow = false; o.renderOrder = 5; } });
  return part;
}
/** Pulse the held ghost so the socket to tap is unmistakable. */
export function pulseGhosts(seconds: number): void { ghostBright.opacity = 0.42 + Math.sin(seconds * 5) * 0.2; }

/** Turn a part's handle to show its setting (index into the allowed settings). */
export function setPartHandle(part: THREE.Object3D, settingIndex: number): void {
  const handle = part.getObjectByName('handle');
  if (handle) handle.rotation.y = settingIndex * Math.PI / 4;
  // Gates and racks slide: each setting raises the board one notch.
  part.traverse(o => { if (o.name === 'slide') o.position.y = (o.userData.base ?? 0) + settingIndex * (o.userData.step ?? 0.12); });
}

/** Spin wheels, drums and flywheels while the machine runs. */
export function animateSitePart(part: THREE.Object3D, seconds: number, running: boolean): void {
  part.traverse(o => {
    if (o.name === 'spin' && running) o.rotation.z = -seconds * (o.userData.speed ?? 9);
    if (o.name === 'glow') o.visible = running;
  });
}
