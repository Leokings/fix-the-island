import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SITE_PLAN} from '../content/site-plan';
import {dryStandingGround,hitsObstacle,sampleGround,type LevelData,type Obstacle,type Vec3,type WalkTriangle} from '../domain/terrain';
import type {RepairDressing} from '../content/repair-dressing';
import type {RepairPropLibrary} from './environment/repair-props';
import {SERVICE_BOARD} from '../content/service-layout';
import {sceneryCandidates} from '../content/imported-scenery';
import {createSceneryInstance} from './environment/scenery-instance';

export interface ImportedWorld {readonly group:THREE.Group;readonly level:LevelData;readonly dressing:readonly RepairDressing[];readonly stats:Readonly<Record<string,unknown>>}
const vec=(v:THREE.Vector3):Vec3=>({x:v.x,y:v.y,z:v.z});
function components(geometry:THREE.BufferGeometry,matrix:THREE.Matrix4):Vec3[][]{
  const attr=geometry.getAttribute('position'),points=Array.from({length:attr.count},(_,i)=>vec(new THREE.Vector3().fromBufferAttribute(attr,i).applyMatrix4(matrix)));
  const indices=geometry.index?Array.from(geometry.index.array):points.map((_,i)=>i),parent=points.map((_,i)=>i),keys=new Map<string,number>();
  const find=(i:number):number=>parent[i]===i?i:parent[i]=find(parent[i]!);
  const join=(a:number,b:number)=>{parent[find(a)]=find(b);};
  for(const [i,p]of points.entries()){const key=[p.x,p.y,p.z].map(n=>Math.round(n*1e4)).join(',');const previous=keys.get(key);if(previous!==undefined)join(i,previous);else keys.set(key,i);}
  for(let i=0;i<indices.length;i+=3){join(indices[i]!,indices[i+1]!);join(indices[i]!,indices[i+2]!);}
  const groups=new Map<number,Vec3[]>();
  for(let i=0;i<indices.length;i+=3){const key=find(indices[i]!);if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(points[indices[i]!]!,points[indices[i+1]!]!,points[indices[i+2]!]!);}
  return [...groups.values()];
}
function hull(points:readonly Vec3[]):readonly Readonly<{x:number;z:number}>[]{
  const sorted=[...new Map(points.map(p=>[`${p.x.toFixed(5)},${p.z.toFixed(5)}`,{x:p.x,z:p.z}])).values()].sort((a,b)=>a.x-b.x||a.z-b.z);
  const cross=(a:typeof sorted[number],b:typeof a,c:typeof a)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
  const half=(points:typeof sorted)=>{const out:typeof sorted=[];for(const p of points){while(out.length>1&&cross(out[out.length-2]!,out[out.length-1]!,p)<=0)out.pop();out.push(p);}out.pop();return out;};
  return [...half(sorted),...half([...sorted].reverse())];
}
/** Classifies this imported single mesh by connected visible components.
 * The widest connected component is the actual sand/green island. Remaining
 * ground-contact components collide only at player height; crowns never become
 * invisible ground blockers. Both floor and collision use transformed asset vertices.
 */
export function buildImportedWorld(group:THREE.Group):ImportedWorld{
  group.updateMatrixWorld(true);const all:Vec3[][]=[];
  group.traverse(object=>{if(object instanceof THREE.Mesh&&object.visible){object.castShadow=object.receiveShadow=true;if(!object.geometry.getAttribute('normal'))object.geometry.computeVertexNormals();all.push(...components(object.geometry,object.matrixWorld));object.userData.category='imported-island';}});
  const bounds=(points:Vec3[])=>new THREE.Box3().setFromPoints(points.map(p=>new THREE.Vector3(p.x,p.y,p.z)));
  all.sort((a,b)=>{const aa=bounds(a).getSize(new THREE.Vector3()),bb=bounds(b).getSize(new THREE.Vector3());return bb.x*bb.z-aa.x*aa.z;});
  const terrain=all[0];if(!terrain)throw new Error('Imported island has no geometry');
  const triangles:WalkTriangle[]=[];
  for(let i=0;i<terrain.length;i+=3){const a=terrain[i]!,b=terrain[i+1]!,c=terrain[i+2]!,normal=new THREE.Vector3().subVectors(new THREE.Vector3(b.x,b.y,b.z),new THREE.Vector3(a.x,a.y,a.z)).cross(new THREE.Vector3(c.x-a.x,c.y-a.y,c.z-a.z));if(normal.y>1e-7)triangles.push({id:`imported-floor:${i/3}`,a,b,c,biome:'tropical'});}
  const box=bounds(terrain),level:LevelData={id:'imported-google-island-v1',spawn:{x:0,y:0,z:0},triangles,obstacles:[],trees:[],visibleSiteIds:SITE_PLAN.map(s=>s.id),surfaceSelection:'highest',saveCompatibleLevelIds:['island-stage-b-v1'],bounds:{minX:box.min.x,maxX:box.max.x,minZ:box.min.z,maxZ:box.max.z}};
  const obstacles:Obstacle[]=[];
  for(const [i,points]of all.slice(1).entries()){
    const b=bounds(points),lowest=points.reduce((a,p)=>p.y<a.y?p:a),ground=sampleGround(level,lowest.x,lowest.z);
    if(!ground||b.min.y>ground.y+.45||b.max.y<ground.y+.1)continue;
    const clipped:Vec3[]=[],ceiling=b.min.y+1.65;
    for(let t=0;t<points.length;t+=3){const polygon=points.slice(t,t+3);for(let v=0;v<3;v++){const a=polygon[v]!,c=polygon[(v+1)%3]!;if(a.y<=ceiling)clipped.push(a);if((a.y<=ceiling)!==(c.y<=ceiling)){const f=(ceiling-a.y)/(c.y-a.y);clipped.push({x:a.x+(c.x-a.x)*f,y:ceiling,z:a.z+(c.z-a.z)*f});}}}
    const footprint=hull(clipped);if(footprint.length<3)continue;
    obstacles.push({id:`visible-island-solid:${i}`,minX:Math.min(...footprint.map(p=>p.x)),maxX:Math.max(...footprint.map(p=>p.x)),minZ:Math.min(...footprint.map(p=>p.z)),maxZ:Math.max(...footprint.map(p=>p.z)),footprint,minY:b.min.y,maxY:b.max.y});
  }
  const solidLevel:LevelData={...level,obstacles};
  const safe:Vec3[]=[];
  // This is placement on actual visible ground, not a movement corridor.
  for(let x=box.min.x+2;x<box.max.x-2;x+=.75)for(let z=box.min.z+2;z<box.max.z-2;z+=.75){const ground=dryStandingGround(solidLevel,{x,y:0,z});if(ground&&ground.normal.y>.965&&[[-1.8,0],[1.8,0],[0,1.8],[0,-1.8]].every(([dx,dz])=>dryStandingGround(solidLevel,{x:x+dx!,y:ground.y,z:z+dz!})))safe.push({x,y:ground.y,z});}
  if(safe.length<8)throw new Error('Imported island lacks eight safe equipment areas');
  const desired:Readonly<Record<string,readonly[number,number]>>={pier_hoist:[-13,18],village_pump:[-13,7],tidal_sluice:[12,15],creek_bridge:[-3,0],coast_windmill:[17,-3],woodland_pathlight:[6,-15],upland_waterworks:[-17,-11],ridge_beacon:[-3,-24]};
  const sites:Record<string,Vec3>={},used:Vec3[]=[];
  for(const site of SITE_PLAN){const target=desired[site.id]!;const candidates=safe.filter(p=>used.every(q=>Math.hypot(q.x-p.x,q.z-p.z)>7));candidates.sort((a,b)=>Math.hypot(a.x-target[0],a.z-target[1])-Math.hypot(b.x-target[0],b.z-target[1]));const p=candidates[0];if(!p)throw new Error(`No visible site spacing for ${site.id}`);sites[site.id]=p;used.push(p);}
  const hoist=sites.pier_hoist!;const spawnCandidates=safe.filter(p=>Math.hypot(p.x-hoist.x,p.z-hoist.z)>2&&Math.hypot(p.x-hoist.x,p.z-hoist.z)<3.3&&used.every(q=>Math.hypot(p.x-q.x,p.z-q.z)>2));spawnCandidates.sort((a,b)=>b.z-a.z);const spawn=spawnCandidates[0];if(!spawn)throw new Error('Imported landing has no clear spawn');
  const kinds:Readonly<Record<string,RepairDressing['kind'][]>>={pier_hoist:['workbench','resource-planks'],village_pump:['machine','pipe-large-valve'],tidal_sluice:['pipe-large-curve','lever-single'],creek_bridge:['resource-planks','workbench'],coast_windmill:['barrel'],woodland_pathlight:['signpost'],upland_waterworks:['hopper-round','pipe-large-long'],ridge_beacon:['piston-round']};
  const dressing:RepairDressing[]=[];
  for(const site of SITE_PLAN)for(const[k,kind]of kinds[site.id]!.entries()){
    const p=sites[site.id]!,x=p.x+(k?2.5:-2.5),z=p.z-1.8,g=dryStandingGround(solidLevel,{x,y:p.y,z});if(!g)continue;
    dressing.push({id:`imported-prop:${site.id}:${k}`,siteId:site.id,kind,position:{x,y:g.y,z},requires:[]});
  }
  const result:LevelData=Object.freeze({...solidLevel,spawn,sitePositions:Object.freeze(sites)});
  return{group,level:result,dressing,stats:{components:all.length,groundTriangles:triangles.length,visibleSolids:obstacles.length,sitePositions:sites,spawn,conditionalFloors:0}};
}
export async function loadImportedWorld():Promise<ImportedWorld>{
  const gltf=await new GLTFLoader().loadAsync(new URL('../../assets/island/google-island.glb',import.meta.url).href),group=new THREE.Group();group.name='Poly by Google — Island';group.add(gltf.scene);
  // A visible, shared nonuniform transform lowers the steep toy-scale island
  // and tall palms. Collision is extracted AFTER this identical transform.
  group.scale.set(.7,.28,.7);group.position.set(9.723,0,-1.003);return buildImportedWorld(group);
}
export function withImportedEquipment(world:ImportedWorld,library:RepairPropLibrary,windmill:THREE.Group):ImportedWorld{
  const obstacles=[...world.level.obstacles];
  const add=(id:string,object:THREE.Object3D)=>{
    object.updateMatrixWorld(true);const points:Vec3[]=[];object.traverse(mesh=>{if(mesh instanceof THREE.Mesh){for(let parent:THREE.Object3D|null=mesh;parent;parent=parent.parent)if(!parent.visible)return;const p=mesh.geometry.getAttribute('position');for(let i=0;i<p.count;i++)points.push(vec(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld)));}});
    const b=new THREE.Box3().setFromObject(object),footprint=hull(points.filter(p=>p.y<b.min.y+1.65));if(footprint.length<3)return;
    obstacles.push({id,minX:Math.min(...footprint.map(p=>p.x)),maxX:Math.max(...footprint.map(p=>p.x)),minZ:Math.min(...footprint.map(p=>p.z)),maxZ:Math.max(...footprint.map(p=>p.z)),footprint,minY:b.min.y,maxY:b.max.y});
  };
  for(const placement of world.dressing){const{root,prop}=createSceneryInstance(library,placement);add(placement.id,root);library.release(prop);}
  const mill=windmill.clone(true),at=world.level.sitePositions!.coast_windmill!;mill.position.set(at.x,at.y,at.z);add('imported-windmill-base',mill);
  for(const site of SITE_PLAN){if(site.id==='creek_bridge'||site.id==='coast_windmill')continue;const p=world.level.sitePositions![site.id]!;obstacles.push({id:`visible-service-board:${site.id}`,minX:p.x-SERVICE_BOARD.width/2,maxX:p.x+SERVICE_BOARD.width/2,minZ:p.z-SERVICE_BOARD.depth/2,maxZ:p.z+SERVICE_BOARD.depth/2,minY:p.y+SERVICE_BOARD.y-SERVICE_BOARD.height/2,maxY:p.y+SERVICE_BOARD.y+SERVICE_BOARD.height/2});}
  const dressing=[...world.dressing],rejected:string[]=[],equipmentSolids=obstacles.length-world.level.obstacles.length;
  for(const placement of sceneryCandidates(world.level)){
    const{root,prop}=createSceneryInstance(library,placement),box=new THREE.Box3().setFromObject(root);
    const samples=[[box.min.x,box.min.z],[box.min.x,box.max.z],[box.max.x,box.min.z],[box.max.x,box.max.z]].map(([x,z])=>sampleGround(world.level,x!,z!));
    const measured=placement.solid===false?[]:measuredSceneryColliders(root,placement.id,world.level,placement.kind==='tent-canvas'||placement.kind==='structure-canvas');
    const site=world.level.sitePositions![placement.siteId]!;
    const publicStances=[world.level.spawn,...[-1.5,0,1.5].map(x=>({x:site.x+x,y:site.y,z:site.z+3})),{x:site.x-2.5,y:site.y,z:site.z+1},{x:site.x+2.5,y:site.y,z:site.z+1}];
    const overlaps=measured.some(a=>obstacles.some(b=>a.minX-.12<b.maxX&&a.maxX+.12>b.minX&&a.minZ-.12<b.maxZ&&a.maxZ+.12>b.minZ&&a.minY!<b.maxY!&&a.maxY!>b.minY!));
    const blocked=measured.some(o=>publicStances.some(p=>hitsObstacle(p,p,o,.55)));
    const supported=samples.every(g=>g&&g.normal.y>.93)&&Math.max(...samples.map(g=>g?.y??Infinity))-Math.min(...samples.map(g=>g?.y??-Infinity))<(placement.solid===false?.65:.38);
    if(!supported||overlaps||blocked){rejected.push(placement.id);library.release(prop);continue;}
    dressing.push(placement);obstacles.push(...measured.map(o=>({...o,...(placement.untilRestored?{blockedUntil:[placement.untilRestored]}:{})})));library.release(prop);
  }
  const level=Object.freeze({...world.level,obstacles:Object.freeze(obstacles)});if(!dryStandingGround(level,level.spawn))throw new Error('Equipment would obstruct the imported landing');
  return{...world,level,dressing:Object.freeze(dressing),stats:{...world.stats,equipmentSolids,sceneryPlacements:dressing.length-world.dressing.length,sceneryColliders:obstacles.length-world.level.obstacles.length-equipmentSolids,sceneryKinds:[...new Set(dressing.filter(p=>p.id.startsWith('scenery:')).map(p=>p.kind))],sceneryRejected:rejected.length}};
}

/** Contact-height components preserve canopy post gaps. Tent cloth is measured
 * per triangle so the open doorway/headroom does not become an invisible box. */
export function measuredSceneryColliders(object:THREE.Object3D,id:string,level:LevelData,perTriangle=false):readonly Obstacle[]{
  object.updateMatrixWorld(true);const groups:Vec3[][]=[];
  object.traverse(mesh=>{if(mesh instanceof THREE.Mesh)for(const part of components(mesh.geometry,mesh.matrixWorld)){
    if(perTriangle)for(let i=0;i<part.length;i+=3)groups.push(part.slice(i,i+3));else groups.push(part);
  }});
  const result:Obstacle[]=[];
  for(const points of groups){
    const lowest=points.reduce((a,b)=>a.y<b.y?a:b),ground=sampleGround(level,lowest.x,lowest.z);if(!ground)continue;
    const minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y)),ceiling=ground.y+1.65;if(minY>ceiling||maxY<ground.y+.04)continue;
    const clipped:Vec3[]=[];
    for(let i=0;i<points.length;i+=3)for(let j=0;j<3;j++){
      const a=points[i+j]!,b=points[i+(j+1)%3]!;if(a.y<=ceiling)clipped.push(a);
      if((a.y<=ceiling)!==(b.y<=ceiling)){const f=(ceiling-a.y)/(b.y-a.y);clipped.push({x:a.x+(b.x-a.x)*f,y:ceiling,z:a.z+(b.z-a.z)*f});}
    }
    const footprint=hull(clipped);if(footprint.length<2)continue;
    result.push({id:`${id}:contact:${result.length}`,minX:Math.min(...footprint.map(p=>p.x)),maxX:Math.max(...footprint.map(p=>p.x)),minZ:Math.min(...footprint.map(p=>p.z)),maxZ:Math.max(...footprint.map(p=>p.z)),footprint,minY,maxY});
  }
  return result;
}
