import { sampleGround,type LevelData,type Obstacle,type Vec3 } from '../domain/terrain';
import { SITE_PLAN } from './site-plan';
import { PUBLIC_ROUTES } from './route-contract';
import type {RepairPropKind} from '../render/environment/repair-props';

// Metre footprints of the already-fitted CC0 library, centred by the renderer.
// The same placements supply collision; no decorative invisible blockers.
const footprints={workbench:[1.303,1.183],barrel:[.592,.592],'resource-planks':[.746,1.252],signpost:[.75,.151],machine:[1.2,1.5],'pipe-large-valve':[1,1.016],'pipe-large-curve':[1.503,1.247],'pipe-large-long':[2,1],'lever-single':[.5,.34],'piston-round':[1,1],'hopper-round':[1.119,1.119]} as const;
type Kind=keyof typeof footprints;
export interface RepairDressing {readonly id:string;readonly siteId:string;readonly kind:RepairPropKind;readonly position:Vec3;readonly requires:readonly string[];readonly yaw?:number;readonly scale?:number;readonly normal?:Vec3;readonly solid?:boolean;readonly untilRestored?:string}
const stock:Readonly<Record<string,readonly Kind[]>>={
  pier_hoist:['workbench','resource-planks','barrel','signpost'],
  village_pump:['machine','pipe-large-valve','pipe-large-long','barrel'],
  tidal_sluice:['pipe-large-curve','lever-single','barrel','signpost'],
  creek_bridge:['resource-planks','workbench','signpost'],
  coast_windmill:['pipe-large-long','workbench','piston-round','barrel'],
  woodland_pathlight:['machine','lever-single','signpost'],
  upland_waterworks:['pipe-large-long','hopper-round','pipe-large-valve','pipe-large-curve','barrel'],
  ridge_beacon:['machine','piston-round','signpost'],
};
const segments=Object.values(PUBLIC_ROUTES).flatMap(route=>route.points.slice(1).map((b,i)=>[route.points[i]!,b] as const));
function distance(x:number,z:number):number {let result=Infinity;for(const[a,b]of segments){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));result=Math.min(result,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));}return result;}
export function withRepairDressing(level:LevelData):{level:LevelData;placements:readonly RepairDressing[]} {
  const all=new Set(level.triangles.flatMap(t=>t.requires??[])),triangles=new Map(level.triangles.map(t=>[t.id,t]));
  const placements:RepairDressing[]=[],obstacles:Obstacle[]=[];
  const offsets=[[2.8,2.1],[-2.8,2.1],[3,-2.5],[-3,-2.5],[4,0],[-4,0],[1.5,-3.8],[-1.5,-3.8],[4.5,2.5],[-4.5,2.5],[4.5,-3],[-4.5,-3]] as const;
  for(const site of SITE_PLAN)for(const kind of stock[site.id]??[]){
    const [width,depth]=footprints[kind],radius=Math.hypot(width,depth)/2;
    for(const[dx,dz]of offsets){
      const x=site.position.x+dx,z=site.position.z+dz;
      if(distance(x,z)<radius+1.3||Math.hypot(x-level.spawn.x,z-level.spawn.z)<radius+1.2)continue;
      const bounds={minX:x-width/2,maxX:x+width/2,minZ:z-depth/2,maxZ:z+depth/2};
      if([...level.obstacles,...obstacles].some(o=>bounds.minX-.35<o.maxX&&bounds.maxX+.35>o.minX&&bounds.minZ-.35<o.maxZ&&bounds.maxZ+.35>o.minZ))continue;
      const samples=[[x,z],[bounds.minX,bounds.minZ],[bounds.minX,bounds.maxZ],[bounds.maxX,bounds.minZ],[bounds.maxX,bounds.maxZ]].map(([sx,sz])=>sampleGround(level,sx!,sz!,all));
      if(samples.some(s=>!s)||Math.max(...samples.map(s=>s!.y))-Math.min(...samples.map(s=>s!.y))>.1)continue;
      const requires=[...new Set([...site.requires,...samples.flatMap(s=>triangles.get(s!.surfaceId)?.requires??[])])];
      const id=`repair-stock:${site.id}:${kind}`,position={x,y:samples[0]!.y,z};
      placements.push({id,siteId:site.id,kind,position,requires});obstacles.push({id,...bounds,requires});break;
    }
  }
  return{level:Object.freeze({...level,obstacles:Object.freeze([...level.obstacles,...obstacles])}),placements:Object.freeze(placements)};
}
