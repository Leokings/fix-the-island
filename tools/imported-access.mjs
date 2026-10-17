import{writeFileSync}from'node:fs';import{cpuImportedModel}from'./imported-geometry.mjs';
const model=await cpuImportedModel(),{level}=model,{dryStandingGround,traverse}=model.terrain;
{
  const restored=new Set(),step=.4,spawn=level.spawn,key=(x,z)=>`${x},${z}`,queue=[{ix:0,iz:0,position:spawn}],seen=new Set([key(0,0)]),approaches=new Map();
  const begin=performance.now();let cursor=0;
  while(cursor<queue.length){const cell=queue[cursor++];for(const[id,p]of Object.entries(level.sitePositions))if(!approaches.has(id)&&Math.hypot(cell.position.x-p.x,cell.position.z-p.z)<(id==='creek_bridge'?6.3:3.5))approaches.set(id,cell.position);
    for(const[dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
      const ix=cell.ix+dx,iz=cell.iz+dz,id=key(ix,iz);if(seen.has(id))continue;const x=spawn.x+ix*step,z=spawn.z+iz*step;if(x<level.bounds.minX||x>level.bounds.maxX||z<level.bounds.minZ||z>level.bounds.maxZ)continue;
      let position=cell.position;let complete=true;
      for(let i=1;i<=4;i++){const target={x:cell.position.x+dx*step*i/4,z:cell.position.z+dz*step*i/4};const moved=traverse(level,position,target.x-position.x,target.z-position.z,restored);position=moved.position;if(Math.hypot(position.x-target.x,position.z-target.z)>1e-5){complete=false;break;}}
      if(complete&&dryStandingGround(level,position,restored)){seen.add(id);queue.push({ix,iz,position});}
    }
  }
  const missing=Object.keys(level.sitePositions).filter(id=>!approaches.has(id)),report={scope:'CPU connectivity using visible imported floor + exact equipment geometry, eight-way .4m grid edges in four .1m traverse increments; zero repairs. Not input/ending evidence.',groundTriangles:level.triangles.length,solidObstacles:level.obstacles.length,reachedGridCells:seen.size,reachedSites:approaches.size,approaches:Object.fromEntries(approaches),missing,elapsedMs:Math.round(performance.now()-begin)};if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(missing.length)process.exitCode=1;
}
