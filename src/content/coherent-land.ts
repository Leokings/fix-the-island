import {sampleGround,type LevelData,type Vec3,type WalkTriangle}from'../domain/terrain';

// Smoothstep island falloff adapted from Small World src/terrain.js at
// 0416bbcf7dbc58b2782f13698c74ac1dde459613, Copyright (c) 2026 Paul Robello.
// MIT permission/copyright notice ships in public/licenses/small-world-MIT.txt.
// Original adaptation here: authored route constraints, shared terrain mesh,
// carved creek/dependency channels, support heights and deterministic banks.
const smoothstep=(a:number,b:number,value:number)=>{const t=Math.max(0,Math.min(1,(value-a)/(b-a)));return t*t*(3-2*t);};
const bridgeBox={minX:-6.5,maxX:6.5,minZ:-4,maxZ:1.5};
const insideBridge=(x:number,z:number)=>x>=bridgeBox.minX&&x<=bridgeBox.maxX&&z>=bridgeBox.minZ&&z<=bridgeBox.maxZ;
interface Point {position:Vec3;requires:readonly string[];biome:string;source:string;distance:number}
export function broadenSharedLand(source:LevelData):LevelData{
  const restored=new Set(source.triangles.flatMap(t=>t.requires??[]));
  const cells=new Map<string,WalkTriangle[]>(),cellSize=4,reach=6;
  for(const triangle of source.triangles){
    const x0=Math.floor((Math.min(triangle.a.x,triangle.b.x,triangle.c.x)-reach)/cellSize),x1=Math.floor((Math.max(triangle.a.x,triangle.b.x,triangle.c.x)+reach)/cellSize);
    const z0=Math.floor((Math.min(triangle.a.z,triangle.b.z,triangle.c.z)-reach)/cellSize),z1=Math.floor((Math.max(triangle.a.z,triangle.b.z,triangle.c.z)+reach)/cellSize);
    for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const key=`${x},${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key)!.push(triangle);}
  }
  const lookup=new Map<string,Point|null>();
  const point=(x:number,z:number):Point|null=>{
    const key=`${x},${z}`;if(lookup.has(key))return lookup.get(key)!;
    const candidates=cells.get(`${Math.floor(x/cellSize)},${Math.floor(z/cellSize)}`)??[],ground=sampleGround(source,x,z,restored);
    let nearest:{distance:number;y:number;triangle:WalkTriangle}|null=null;
    for(const triangle of candidates){
      if(ground&&triangle.id===ground.surfaceId){nearest={distance:0,y:ground.y,triangle};break;}
      for(const [a,b]of [[triangle.a,triangle.b],[triangle.b,triangle.c],[triangle.c,triangle.a]] as const){
        const dx=b.x-a.x,dz=b.z-a.z,len=dx*dx+dz*dz,t=len?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/len)):0;
        const distance=Math.hypot(x-a.x-dx*t,z-a.z-dz*t);
        if(!nearest||distance<nearest.distance)nearest={distance,y:a.y+(b.y-a.y)*t,triangle};
      }
    }
    // A real open creek separates the west bank from the upper island.
    // Only the preserved bridge/workwalk geometry may occupy this channel.
    if(!nearest||nearest.distance>reach||(x>-3&&x<3&&z>-20&&z<20&&!insideBridge(x,z))){lookup.set(key,null);return null;}
    const requirements=new Set(nearest.triangle.requires??[]);
    if(x<-3&&z<3&&z>-20){requirements.add('village_pump');requirements.add('tidal_sluice');}
    if(x>=0&&z<-28.8)requirements.add('woodland_pathlight');
    if(x>=0&&z<-39){requirements.add('woodland_pathlight');requirements.add('upland_waterworks');}
    // Source roads/pads retain their sampled heights. Broad visible margins
    // get a shallow deterministic falloff, never an independent scenery floor.
    const d=nearest.distance,noise=(Math.sin(x*.21+z*.17)*.035+Math.sin(x*.47-z*.13)*.015)*smoothstep(0,2,d);
    const y=nearest.y-.6*smoothstep(3.5,reach,d)+noise;
    const result={position:{x,y,z},requires:[...requirements].sort(),biome:nearest.triangle.biome,source:nearest.triangle.id,distance:d};lookup.set(key,result);return result;
  };
  const triangles:WalkTriangle[]=[],banks:(readonly[Vec3,Vec3])[]=[];
  const add=(id:string,a:Point,b:Point,c:Point)=>{
    const requires=[...new Set([...a.requires,...b.requires,...c.requires])].sort();
    triangles.push({id,a:a.position,b:b.position,c:c.position,biome:a.biome,requires});
  };
  const spacing=.5;
  for(let x=-50;x<49;x+=spacing)for(let z=-61;z<56;z+=spacing){
    if(insideBridge(x+spacing/2,z+spacing/2))continue;
    const a=point(x,z),b=point(x+spacing,z),c=point(x,z+spacing),d=point(x+spacing,z+spacing);
    if(a&&b&&c)add(`land:${x}:${z}:a`,a,c,b);
    if(b&&c&&d)add(`land:${x}:${z}:b`,b,c,d);
    if(a&&b&&(!c||!d))banks.push([a.position,b.position]);
    if(a&&c&&(!b||!d))banks.push([c.position,a.position]);
    if(b&&d&&(!a||!c))banks.push([b.position,d.position]);
    if(c&&d&&(!a||!b))banks.push([d.position,c.position]);
  }
  // Clip original physical bridge/service geometry to the grid-aligned gap.
  // Its literal span and approval dependency cannot be filled by broader land.
  for(const triangle of source.triangles){
    if(Math.max(triangle.a.x,triangle.b.x,triangle.c.x)<bridgeBox.minX||Math.min(triangle.a.x,triangle.b.x,triangle.c.x)>bridgeBox.maxX||Math.max(triangle.a.z,triangle.b.z,triangle.c.z)<bridgeBox.minZ||Math.min(triangle.a.z,triangle.b.z,triangle.c.z)>bridgeBox.maxZ)continue;
    let polygon=[triangle.a,triangle.b,triangle.c];
    for(const[axis,bound,above]of [['x',bridgeBox.minX,true],['x',bridgeBox.maxX,false],['z',bridgeBox.minZ,true],['z',bridgeBox.maxZ,false]] as const){
      const out:Vec3[]=[];
      for(let i=0;i<polygon.length;i++){const a=polygon[i]!,b=polygon[(i+1)%polygon.length]!,has=(v:Vec3)=>above?v[axis]>=bound:v[axis]<=bound;if(has(a))out.push(a);if(has(a)!==has(b)){const t=(bound-a[axis])/(b[axis]-a[axis]);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});}}
      polygon=out;
    }
    for(let i=1;i<polygon.length-1;i++){const a=polygon[0]!,b=polygon[i]!,c=polygon[i+1]!;if(Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))>1e-9)triangles.push({...triangle,a,b,c});}
  }
  // Nature must be grounded on this same level, not its former pad estimate.
  const provisional:LevelData={...source,triangles};
  const treeIds=new Set<string>();
  const trees=source.trees.flatMap((tree,i)=>{const ground=sampleGround(provisional,tree.x,tree.z,restored);if(!ground)return[];treeIds.add(`tree-${i}`);return[{x:tree.x,y:ground.y,z:tree.z}];});
  const obstacles=source.obstacles.filter(o=>!o.id.startsWith('tree-')||treeIds.has(o.id));
  return Object.freeze({...source,triangles:Object.freeze(triangles),banks:Object.freeze(banks),trees:Object.freeze(trees),obstacles:Object.freeze(obstacles)});
}
