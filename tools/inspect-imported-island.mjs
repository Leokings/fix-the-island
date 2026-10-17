import {readFileSync} from 'node:fs';
const bytes=readFileSync(new URL('../assets/island/google-island.glb',import.meta.url));
const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
const binaryStart=20+bytes.readUInt32LE(12)+8;
function accessor(id){const a=json.accessors[id],view=json.bufferViews[a.bufferView],n={VEC3:3,VEC2:2,SCALAR:1}[a.type],size=a.componentType===5126?4:2;return Array.from({length:a.count},(_,i)=>Array.from({length:n},(_,j)=>{const offset=binaryStart+(view.byteOffset??0)+(a.byteOffset??0)+i*(view.byteStride??size*n)+j*size;return a.componentType===5126?bytes.readFloatLE(offset):bytes.readUInt16LE(offset);}));}
const primitive=json.meshes[0].primitives[0],points=accessor(primitive.attributes.POSITION),indices=accessor(primitive.indices).flat();
const parent=points.map((_,i)=>i),keys=new Map();
function find(i){return parent[i]===i?i:parent[i]=find(parent[i]);}
function join(a,b){parent[find(a)]=find(b);}
points.forEach((p,i)=>{const key=p.map(v=>Math.round(v*1e4)).join(',');if(keys.has(key))join(i,keys.get(key));else keys.set(key,i);});
for(let i=0;i<indices.length;i+=3){join(indices[i],indices[i+1]);join(indices[i],indices[i+2]);}
const groups=new Map();for(let i=0;i<indices.length;i+=3){const key=find(indices[i]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(...indices.slice(i,i+3));}
console.log([...groups.values()].map(ids=>{const p=ids.map(i=>points[i]);return {triangles:ids.length/3,min:[0,1,2].map(a=>Math.min(...p.map(v=>v[a]))),max:[0,1,2].map(a=>Math.max(...p.map(v=>v[a])))};}).sort((a,b)=>b.triangles-a.triangles));
