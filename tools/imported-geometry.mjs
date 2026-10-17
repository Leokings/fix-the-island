import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

globalThis.ProgressEvent??=class extends Event{constructor(type,details){super(type);Object.assign(this,details);}};
// CPU transport omits texture decoding only; source vertices and transforms
// are unchanged. No listener, HMR, game-state setter or browser scene injection.
export async function geometryScene(path){
  const bytes=await readFile(new URL(path,import.meta.url)),length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length).toString()),binary=bytes.subarray(28+length);
  delete json.images;delete json.textures;
  for(const m of json.materials??[]){delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;if(m.pbrMetallicRoughness){delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture;}}
  json.buffers[0].uri=`data:application/octet-stream;base64,${binary.toString('base64')}`;
  return(await new GLTFLoader().parseAsync(JSON.stringify(json),'')).scene;
}
export async function cpuImportedModel(){
  const root=fileURLToPath(new URL('../',import.meta.url)),server=await createServer({root,configFile:false,server:{middlewareMode:true,hmr:false,ws:false,watch:null},appType:'custom'});
  try{
    const[world,terrain,steering,props]=await Promise.all([server.ssrLoadModule('/src/render/imported-world.ts'),server.ssrLoadModule('/src/domain/terrain.ts'),server.ssrLoadModule('/src/input/corridor-steering.ts'),server.ssrLoadModule('/src/render/environment/repair-props.ts')]);
    const group=new THREE.Group();group.add(await geometryScene('../assets/island/google-island.glb'));group.scale.set(.7,.28,.7);group.position.set(9.723,0,-1.003);
    const stock=new Map();for(const[kind,def]of Object.entries(props.REPAIR_PROP_SOURCES))stock.set(kind,await geometryScene(`../assets/props/kenney-${def.pack}/${kind}.glb`));
    const library={create(kind){const root=new THREE.Group();root.add(stock.get(kind).clone(true));root.scale.setScalar(props.REPAIR_PROP_SOURCES[kind].scale);return root;},release:object=>object.removeFromParent()};
    const mill=await geometryScene('../assets/windmill/headland-windmill.glb');mill.getObjectByName('InputGearRoot').visible=false;mill.getObjectByName('OutputGearRoot').visible=false;
    const imported=world.withImportedEquipment(world.buildImportedWorld(group),library,mill);
    return{...imported,terrain,steering};
  }finally{await server.close();}
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function safeSegment(model,from,to,restored=new Set()){
  let p=from;const n=Math.max(1,Math.ceil(distance(from,to)/.09));
  for(let i=1;i<=n;i++){const x=from.x+(to.x-from.x)*i/n,z=from.z+(to.z-from.z)*i/n;p=model.terrain.traverse(model.level,p,x-p.x,z-p.z,restored).position;if(Math.hypot(p.x-x,p.z-z)>1e-5)return null;}
  return model.terrain.dryStandingGround(model.level,p,restored)?p:null;
}
export function pathTo(model,start,target,radius=.3){
  const step=.4,queue=[{x:0,z:0,position:start,parent:-1}],seen=new Set(['0,0']);let found=-1;
  for(let cursor=0;cursor<queue.length;cursor++){
    const cell=queue[cursor];if(distance(cell.position,target)<radius){found=cursor;break;}
    for(const[dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
      const x=cell.x+dx,z=cell.z+dz,key=`${x},${z}`;if(seen.has(key))continue;
      const end={x:start.x+x*step,z:start.z+z*step},b=model.level.bounds;if(end.x<b.minX||end.x>b.maxX||end.z<b.minZ||end.z>b.maxZ)continue;
      const position=safeSegment(model,cell.position,end);if(position){seen.add(key);queue.push({x,z,position,parent:cursor});}
    }
  }
  if(found<0)throw new Error(`No actual-ground path to ${JSON.stringify(target)} from ${JSON.stringify(start)} (${queue.length} cells)`);
  const raw=[];for(let i=found;i>=0;i=queue[i].parent)raw.push(queue[i].position);raw.reverse();const points=[raw[0]];
  for(let i=0;i<raw.length-1;){let next=i+1;for(let j=i+2;j<raw.length&&distance(raw[i],raw[j])<=2;j++)if(safeSegment(model,raw[i],raw[j]))next=j;points.push(raw[next]);i=next;}
  return points;
}
