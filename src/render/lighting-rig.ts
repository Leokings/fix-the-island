import * as THREE from 'three';
import { PUBLIC_ROUTES } from '../content/route-contract';
import type { RenderStyle } from './contract';

// Renderer-only C1 value blocking. These masks never add a floor, change a
// vertex, authorize a route, or alter the domain's immutable route contract.
const smooth=(a:number,b:number,x:number)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const pathSegments=Object.entries(PUBLIC_ROUTES).filter(([id])=>!['pierStances','bridgeDeck','workwalk'].includes(id))
  .flatMap(([,route])=>route.points.slice(1).map((p,i)=>[route.points[i]!,p]as const));
function distanceToPath(x:number,z:number):number {
  let distance=Infinity;
  for(const [a,b]of pathSegments){const dx=b.x-a.x,dz=b.z-a.z,t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);distance=Math.min(distance,Math.hypot(x-a.x-t*dx,z-a.z-t*dz));}
  return distance;
}
/** Provisional broad colour masses; C2 owns final surface breakup/decals. */
export function groundValueColor(x:number,y:number,z:number):THREE.Color {
  const upland=smooth(12,17,y),coast=smooth(15,25,z);
  const base=new THREE.Color('#a7ad63').lerp(new THREE.Color('#c7c8d5'),upland);
  base.lerp(new THREE.Color('#c8bb83'),coast*.65);
  const path=1-smooth(.72,1.18,distanceToPath(x,z));
  return base.lerp(new THREE.Color('#c6974e'),path);
}

export interface LightingProfile {
  readonly upland:number;readonly keyColor:THREE.Color;readonly keyIntensity:number;
  readonly sky:THREE.Color;readonly bounce:THREE.Color;readonly fillIntensity:number;
  readonly fog:THREE.Color;readonly fogNear:number;readonly fogFar:number;readonly exposure:number;
  readonly gradePower:THREE.Vector3;readonly gradeMultiply:THREE.Vector3;readonly gradeLift:THREE.Vector3;
}
export function lightingProfile(style:RenderStyle,height:number):LightingProfile {
  const upland=smooth(8.4,9.8,height);
  // The biome moderates explicit caller inputs; it never replaces them with an
  // id-selected preset. Even in the upper district a custom/swap rig is real.
  const mix=(a:string,b:string,amount:number)=>new THREE.Color(a).lerp(new THREE.Color(b),upland*amount);
  return {upland,keyColor:mix(style.keyColor,'#f1e8e3',.28),keyIntensity:style.keyIntensity*THREE.MathUtils.lerp(1,.9,upland),
    sky:mix(style.fillSky,'#cbc7ef',.6),bounce:mix(style.fillGround,'#9697b6',.55),fillIntensity:style.fill??THREE.MathUtils.lerp(2.5,2.85,upland),
    fog:mix(style.fog,'#c2c7e6',.65),fogNear:THREE.MathUtils.lerp(39,36,upland),fogFar:THREE.MathUtils.lerp(88,76,upland),
    exposure:style.exposure,gradePower:new THREE.Vector3(.98,.99,1),
    gradeMultiply:new THREE.Vector3(1.025,1.01,.975).lerp(new THREE.Vector3(1,1.005,1.025),upland),
    gradeLift:new THREE.Vector3(.004,.005,.007).lerp(new THREE.Vector3(.006,.006,.012),upland)};
}

/**
 * Night to dawn. The island starts at night after the storm and the sky lightens
 * as sites are repaired; daylight 0 is night, about .8 is first light, 1 is the
 * full daytime profile above. Display only: it follows restored repairs.
 */
const NIGHT={key:'#9db2ff',sky:'#41507f',bounce:'#2b3350',fog:'#1d2742',grade:new THREE.Vector3(.86,.93,1.12),lift:new THREE.Vector3(.004,.008,.022)};
const DAWN={key:'#ffb07c',sky:'#c9a7b8',bounce:'#8a6f68',fog:'#e9b79a',grade:new THREE.Vector3(1.06,.98,.93),lift:new THREE.Vector3(.012,.006,.004)};
export function withDaylight(day:LightingProfile,daylight:number):LightingProfile {
  const d=THREE.MathUtils.clamp(daylight,0,1);
  // Night → dawn over the first 80%, dawn → day over the last 20%.
  const a=d<.8?d/.8:1,b=d<.8?0:(d-.8)/.2;
  const pick=(night:string,dawn:string,dayColor:THREE.Color)=>new THREE.Color(night).lerp(new THREE.Color(dawn),smooth(0,1,a)).lerp(dayColor,smooth(0,1,b));
  const vec=(night:THREE.Vector3,dawn:THREE.Vector3,dayVec:THREE.Vector3)=>night.clone().lerp(dawn,smooth(0,1,a)).lerp(dayVec,smooth(0,1,b));
  const level=THREE.MathUtils.lerp(THREE.MathUtils.lerp(.42,.72,smooth(0,1,a)),1,smooth(0,1,b));
  return {...day,keyColor:pick(NIGHT.key,DAWN.key,day.keyColor),keyIntensity:day.keyIntensity*level,
    sky:pick(NIGHT.sky,DAWN.sky,day.sky),bounce:pick(NIGHT.bounce,DAWN.bounce,day.bounce),
    fillIntensity:day.fillIntensity*THREE.MathUtils.lerp(.7,1,smooth(0,1,d)),
    fog:pick(NIGHT.fog,DAWN.fog,day.fog),exposure:day.exposure*THREE.MathUtils.lerp(.9,1,smooth(0,1,d)),
    gradeMultiply:vec(NIGHT.grade,DAWN.grade,day.gradeMultiply),gradeLift:vec(NIGHT.lift,DAWN.lift,day.gradeLift)};
}
