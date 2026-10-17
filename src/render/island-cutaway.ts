import * as THREE from 'three';
import {sampleGround,type LevelData} from '../domain/terrain';

export interface ProtectedView {readonly point:THREE.Vector3;readonly radius:number}
/** A foreground test only: never changes the imported surface or collision. */
export function occludesView(bounds:THREE.Box3,eye:THREE.Vector3,view:ProtectedView):boolean {
  const direction=eye.clone().sub(view.point),length=direction.length();
  if(length<.01)return false;direction.divideScalar(length);
  if(bounds.getCenter(new THREE.Vector3()).sub(view.point).dot(direction)<.5)return false;
  const expanded=bounds.clone();expanded.min.x-=view.radius;expanded.max.x+=view.radius;
  expanded.min.z-=view.radius;expanded.max.z+=view.radius;
  const hit=new THREE.Ray(view.point,direction).intersectBox(expanded,new THREE.Vector3());
  return !!hit&&hit.distanceTo(view.point)>.35&&hit.distanceTo(view.point)<length;
}

/** Clean component-wide cutaways, not stippled circular holes. The widest
 * connected component (the island floor) is NEVER clipped. Contact-height
 * trunks/rocks remain visible; only their upper foreground geometry clears. */
export function createIslandCutaway(group:THREE.Group,level:LevelData) {
  const records:{geometry:THREE.BufferGeometry;mask:THREE.BufferAttribute;parts:{indices:number[];bounds:THREE.Box3;active:boolean;level:number}[]}[]=[];
  group.updateMatrixWorld(true);
  group.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    const geometry=object.geometry as THREE.BufferGeometry,p=geometry.getAttribute('position'),parent=Array.from({length:p.count},(_,i)=>i);
    const find=(i:number):number=>parent[i]===i?i:parent[i]=find(parent[i]!);
    const join=(a:number,b:number)=>{parent[find(a)]=find(b);};
    const coincident=new Map<string,number>(),points:THREE.Vector3[]=[];
    for(let i=0;i<p.count;i++){
      const point=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(object.matrixWorld);points.push(point);
      const key=[point.x,point.y,point.z].map(n=>Math.round(n*1e4)).join(',');
      const previous=coincident.get(key);if(previous===undefined)coincident.set(key,i);else join(i,previous);
    }
    const order=geometry.index?Array.from(geometry.index.array):parent.map((_,i)=>i);
    for(let i=0;i<order.length;i+=3){join(order[i]!,order[i+1]!);join(order[i]!,order[i+2]!);}
    const groups=new Map<number,number[]>();
    for(let i=0;i<p.count;i++){const id=find(i);if(!groups.has(id))groups.set(id,[]);groups.get(id)!.push(i);}
    const parts=[...groups.values()].map(indices=>({level:0,indices,bounds:new THREE.Box3().setFromPoints(indices.map(i=>points[i]!)),active:false}));
    const area=(b:THREE.Box3)=>(b.max.x-b.min.x)*(b.max.z-b.min.z);
    const terrain=parts.reduce((a,b)=>area(a.bounds)>area(b.bounds)?a:b);
    const mask=new THREE.BufferAttribute(new Float32Array(p.count),1).setUsage(THREE.DynamicDrawUsage);
    const top=new THREE.BufferAttribute(new Float32Array(p.count),1);
    for(const part of parts){
      const centre=part.bounds.getCenter(new THREE.Vector3()),ground=sampleGround(level,centre.x,centre.z);
      // Retain the complete 1.65 m collision/contact silhouette plus margin.
      const contactTop=Math.max(ground?.y??part.bounds.min.y,Math.min(part.bounds.min.y,(ground?.y??part.bounds.min.y)+.45))+1.8;
      for(const i of part.indices)top.setX(i,contactTop);
    }
    geometry.setAttribute('islandCutaway',mask);geometry.setAttribute('islandContactTop',top);
    records.push({geometry,mask,parts:parts.filter(part=>part!==terrain)});
    const copies=(Array.isArray(object.material)?object.material:[object.material]).map(material=>{
      const copy=material.clone();copy.onBeforeCompile=(shader:Parameters<THREE.Material['onBeforeCompile']>[0])=>{
        shader.vertexShader='attribute float islandCutaway;attribute float islandContactTop;varying vec3 islandWorldPosition;varying float islandMask;varying float islandTop;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nislandWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz;islandMask=islandCutaway;islandTop=islandContactTop;');
        shader.fragmentShader='varying vec3 islandWorldPosition;varying float islandMask;varying float islandTop;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>','#include <dithering_fragment>\nfloat islandIgn=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))));if(islandMask>0.001&&islandWorldPosition.y>islandTop&&islandIgn<islandMask)discard;');
      };copy.customProgramCacheKey=()=> 'island-component-cutaway-dissolve-v2';return copy;
    });object.material=Array.isArray(object.material)?copies:copies[0]!;
  });
  return {update(eye:THREE.Vector3,views:readonly ProtectedView[],enabled=true){
    let active=0;
    for(const record of records){let changed=false;for(const part of record.parts){
      // Dissolve in and out over a few frames instead of popping; full fade only while it covers a protected view.
      const visible=enabled&&views.some(view=>occludesView(part.bounds,eye,view));if(visible)active++;
      part.active=visible;const target=visible?0.92:0;if(part.level===target)continue;
      part.level=visible?Math.min(target,part.level+0.14):Math.max(0,part.level-0.1);changed=true;
      for(const i of part.indices)record.mask.setX(i,part.level);
    }if(changed)record.mask.needsUpdate=true;}
    return active;
  }};
}
