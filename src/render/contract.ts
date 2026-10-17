import type { LevelData } from '../domain/terrain';
import type { WorldSnapshot } from '../domain/world';
import type { RepairEndpoint } from '../genlayer';
import type { Rect } from './layout';

export interface CameraPreset {
  readonly yawDegrees: number; readonly pitchDegrees: number; readonly span: number;
  readonly distance: number; readonly targetHeight: number; readonly followSeconds: number;
}
export interface RenderStyle {
  readonly id: string; readonly ground: string; readonly wood: string; readonly metal: string;
  readonly foliage: string; readonly water: string; readonly fog: string;
  readonly keyColor: string; readonly keyIntensity: number; readonly keyOffset: readonly [number, number, number];
  readonly fillSky: string; readonly fillGround: string; readonly exposure: number; readonly roughness: number;
  /** Hemisphere fill strength; defaults to the legacy rig's value when omitted. */
  readonly fill?: number;
}
export interface RepairRenderLayout {readonly inset:Rect;readonly protectedScene:Rect;readonly keyboardOpen:boolean;readonly blueprint?:readonly string[];readonly buildStep?:'place'|'connect'|'set'}
export interface RenderFrame { readonly alpha: number; readonly elapsedSeconds: number;readonly repairLayout?:RepairRenderLayout;readonly overview?:boolean }
export interface HitAnchor {
  readonly kind:'socket'|'port';readonly siteId:string;readonly slotId:string;readonly label:string;
  readonly endpoint:RepairEndpoint|null;readonly view:'world'|'inset';readonly x:number;readonly y:number;
  readonly visible:boolean;
}
/** Camera shot for a site council's reveal: the whole council, or one member. Null returns to play. */
export type CouncilShot = Readonly<{ siteId: string; member: number | null }> | null;
export type CouncilGesture = 'leader' | 'agree' | 'disagree' | 'timeout';
/**
 * Display-only handle on the eight site councils (five members each: slot 0 is the
 * leader's seat, 1-4 the validators'). It cannot grant or change progress.
 */
export interface CouncilStage {
  setShot(shot: CouncilShot): void;
  setFire(mood: 'bright' | 'steady' | 'low'): void;
  size(siteId: string): number;
  /** What a member does between reviews: fish, sunbathe, walk, sit or tinker. */
  activity(siteId: string, member: number): string | null;
  /** Stop the member's activity and turn them toward the camera. */
  engage(siteId: string, member: number): void;
  /** Back to their activity. */
  release(siteId: string, member: number): void;
  gesture(siteId: string, member: number, gesture: CouncilGesture): void;
  settle(siteId: string, member: number): void;
  /** Screen position (CSS px) above a member's head, or null when off screen. */
  bubble(siteId: string, member: number): Readonly<{ x: number; y: number }> | null;
  /** Screen position (CSS px) above the leader, or null when off screen. */
  beacon(siteId: string): Readonly<{ x: number; y: number }> | null;
  /** Ground position of the council's middle, for near-the-council checks. */
  centre(siteId: string): Readonly<{ x: number; z: number }> | null;
}
export interface RendererContract {
  initialize(host: HTMLElement, level: LevelData): void;
  resize(width: number, height: number, pixelRatio: number): void;
  render(snapshot: WorldSnapshot, frame: RenderFrame): void;
  pick(point: Readonly<{ x: number; y: number }>): string | null;
  setStyle(style: RenderStyle): void;
  hitAnchors():readonly HitAnchor[];
  objectiveAnchor(siteId:string):Readonly<{x:number;y:number}>|null;
  measureComposition():Readonly<Record<string,unknown>>;
  /** The council at the commons fire, once its models have loaded (stylized island only). */
  councilStage?():CouncilStage|null;
  dispose(): void;
}
