import type { SiteId } from '../genlayer';

// Public movement and capture stances, not puzzle solutions or progression.
// Y always comes from the game's shared visible floor. Reverse traversal uses
// the same corners; callers must never shortcut across equipment or rail tips.
export interface RoutePoint { readonly x:number; readonly z:number }
export interface PublicRoute {
  readonly id:string;
  readonly points:readonly RoutePoint[];
  readonly acceptance:number;
  readonly corridorRadius:number;
  readonly requires:readonly SiteId[];
}
const coastal:readonly SiteId[]=['pier_hoist','village_pump','tidal_sluice'];
const crossed:readonly SiteId[]=[...coastal,'creek_bridge'];
const lit:readonly SiteId[]=[...crossed,'coast_windmill','woodland_pathlight'];
const watered:readonly SiteId[]=[...crossed,'upland_waterworks'];
const route=(id:string,points:readonly (readonly [number,number])[],requires:readonly SiteId[]=[],acceptance=.15):PublicRoute=>Object.freeze({
  id,points:Object.freeze(points.map(([x,z])=>Object.freeze({x,z}))),
  acceptance,corridorRadius:.65,requires:Object.freeze([...requires]),
});

export const PUBLIC_ROUTES=Object.freeze({
  pierStances:route('pier-stances',[[-38,44],[-38,42.8],[-40,42.8],[-39.2,42.8],[-38,42.8],[-38,44]]),
  pierPump:route('pier-pump',[[-38,44],[-34.6,43.5],[-34.6,39],[-30,32]]),
  pumpService:route('pump-service',[[-30,32],[-20.6,24.3],[-21.2,23.8],[-18,24.2]]),
  shore:route('shore-sluice',[[-38,44],[-12,44],[12,48],[27.5,39.8],[30,40.2]]),
  pumpApproach:route('pump-approach',[[-18,24.2],[-21.2,23.8],[-21.2,23.3],[-21.2,20.7],[-19.6,19.7],[-17,19.5],[-15.8,18.3],[-12,12],[-8,4]],coastal),
  bridgeApproach:route('bridge-approach',[[-8,4],[-5.7,-2]],coastal),
  workwalk:route('bridge-workwalk',[[-5.7,-2],[-5.7,.45],[1,.45]],coastal),
  bridgeDeck:route('bridge-deck',[[-5.7,-2],[0,-2],[5,-2],[6.1,-2]],crossed),
  headland:route('headland-windmill',[[6.1,-2],[20,-8],[37.2,-13.3],[37.2,-11.2],[40,-11.2]],crossed),
  branchJoin:route('east-shoe-branch',[[6.1,-2],[6.1,-4.5]],crossed),
  lightEntry:route('light-entry',[[6.1,-4.5],[12,-18],[16.6,-21.8],[18,-21.8]],crossed),
  cisternBranch:route('cistern-branch',[[6.1,-4.5],[5,-4.5],[4,-20],[-8,-30]],crossed),
  cisternService:route('cistern-service',[[-8,-30],[-23.1,-33.4],[-23.1,-32.2],[-26,-31.8]],crossed),
  lightBypass:route('light-bypass',[[18,-21.8],[16.6,-21.8],[21.2,-22.6],[21.2,-25.4],[16.7,-26.3]],lit),
  upperWalk:route('upper-walk',[[16.7,-26.3],[8,-38],[12,-44],[12,-49.2]],[...lit,'upland_waterworks']),
  westReturn:route('west-return',[[-26,-31.8],[-28.9,-31.8],[-28.9,-29.4],[-36,-18],[-38,0],[-32,24],[-30,32],[-34.6,39],[-34.6,43.5],[-38,44]],watered),
});
export type PublicRouteId=keyof typeof PUBLIC_ROUTES;
export const INSPECTION_STANCES:Readonly<Record<SiteId,RoutePoint>>=Object.freeze({
  pier_hoist:{x:-38,z:42.8},village_pump:{x:-18,z:24.2},tidal_sluice:{x:30,z:40.2},
  creek_bridge:{x:1,z:.45},coast_windmill:{x:40,z:-11.2},woodland_pathlight:{x:18,z:-21.8},
  upland_waterworks:{x:-26,z:-31.8},ridge_beacon:{x:12,z:-49.2},
});
export const COMPOSITION_STANCES=Object.freeze({
  'ref-01':{x:-40,z:42.8},'ref-02':INSPECTION_STANCES.coast_windmill,
  'ref-03':INSPECTION_STANCES.creek_bridge,'ref-04':INSPECTION_STANCES.tidal_sluice,
  'ref-05':INSPECTION_STANCES.upland_waterworks,'ref-06':{x:-39.2,z:42.8},
});
export function routePoints(id:PublicRouteId,reverse=false):readonly RoutePoint[]{
  return reverse?[...PUBLIC_ROUTES[id].points].reverse():PUBLIC_ROUTES[id].points;
}
