import {sampleGround,type LevelData} from '../domain/terrain';
import type {RepairDressing} from './repair-dressing';
import {pathDistance} from './stylized-island';
import {SERVICE_BOARD} from './service-layout';

// Approximate plan radius (m) of each work-area prop, for keeping walking room clear.
const REACH:Readonly<Partial<Record<RepairDressing['kind'],number>>>={barrel:.32,box:.35,'box-large':.6,fence:.6,'pipe-large-long':1,signpost:.4,'tent-canvas':1.3,'structure-canvas':1.3,'tree-log-small':.7,'resource-planks':.7};
/**
 * On the stylized island the work areas (authored for the earlier island) must not crowd the walk:
 * every prop keeps clear of footpaths and leaves at least 1 m to walk around each site's platform.
 */
function clearOfWalks(level:LevelData,kind:RepairDressing['kind'],x:number,z:number):boolean {
  if(!level.id.startsWith('stylized-island'))return true;
  const reach=REACH[kind]??.5;
  if(pathDistance({x,z})<1.4+reach)return false;
  for(const[id,p]of Object.entries(level.sitePositions??{})){
    if(id==='creek_bridge'||id==='coast_windmill')continue;
    const gx=Math.max(0,Math.abs(x-p.x)-SERVICE_BOARD.width/2),gz=Math.max(0,Math.abs(z-p.z)-SERVICE_BOARD.depth/2);
    if(Math.hypot(gx,gz)<1+reach)return false;
  }
  return true;
}

type Item=readonly[kind:RepairDressing['kind'],x:number,z:number,yaw?:number,cleanup?:boolean];
// Local work areas, not navigation corridors. Existing site coordinates and
// terrain are immutable; actual model footprints decide which candidates fit.
const workAreas:Readonly<Record<string,readonly Item[]>>={
  pier_hoist:[['structure-canvas',-3.5,-2.8],['tent-canvas',-4.4,1.1,Math.PI/2],['box-large',-4.3,-1.8],['box',-3.7,-.3],['barrel',-2.8,-.1],['barrel',-3.5,.5],['signpost',-4.2,3.2],['fence',-3.4,-3.6],['fence',-4.5,-3.6],['resource-planks',-3.7,4.3,.6,true]],
  village_pump:[['fence',2.1,-3.4],['fence',3.2,-3.4],['fence',4.3,-3.4],['fence',4.5,-2.2,Math.PI/2],['fence',4.5,-1.1,Math.PI/2],['barrel',2.8,-.2],['barrel',3.55,-.2],['box-large',3.6,-1.8],['box',3.6,-2.7],['pipe-large-long',4.6,1.9,Math.PI/2],['signpost',-3.9,1.8]],
  tidal_sluice:[['fence',-3.4,-3],['fence',-2.3,-3],['fence',-1.2,-3],['fence',1.4,-3],['fence',2.5,-3],['barrel',-2.8,-.3],['box-large',-3.6,-.3],['tree-log-small',-4.6,-.3,.3,true],['signpost',-3.5,3.1]],
  creek_bridge:[['box-large',-3,2.7],['barrel',-3.8,2.6],['tree-log-small',3.4,2.2,Math.PI/2,true]],
  coast_windmill:[['box-large',-3.8,1.8],['box',-3.8,2.7],['fence',-3.9,-3.3],['fence',-2.8,-3.3],['signpost',-4.2,3.8]],
  woodland_pathlight:[['box',-2.8,2.2],['barrel',-3.4,2.1],['fence',-3.2,-3.1],['fence',-2.1,-3.1]],
  upland_waterworks:[['barrel',-3.2,1.8],['barrel',-4,1.8],['box-large',2.7,2.8],['fence',-3.1,-3.1],['fence',-2,-3.1],['signpost',-4.1,2.8]],
  ridge_beacon:[['box-large',-3.6,1.8],['barrel',-3.5,2.7],['fence',-3.2,-3.5],['fence',-2.1,-3.5],['signpost',-4.2,3.3]],
};
export function sceneryCandidates(level:LevelData):readonly RepairDressing[]{
  const result:RepairDressing[]=[];
  for(const[siteId,items]of Object.entries(workAreas)){
    const site=level.sitePositions?.[siteId];if(!site)continue;
    const add=(kind:RepairDressing['kind'],dx:number,dz:number,yaw=0,cleanup=false,solid=true)=>{
      const x=site.x+dx,z=site.z+dz,g=sampleGround(level,x,z);if(!g||g.normal.y<.95)return;
      if(solid&&!clearOfWalks(level,kind,x,z))return;
      result.push({id:`scenery:${siteId}:${result.length}`,siteId,kind,position:{x,y:g.y,z},normal:g.normal,yaw,requires:[],solid,...(cleanup?{untilRestored:siteId}:{})});
    };
    for(const[kind,x,z,yaw,cleanup]of items)add(kind,x,z,yaw,cleanup);
    // Planted pockets line the public clearing without colliding or claiming
    // habitat restoration. The reedbed gets a coherent denser green patch.
    for(const[x,z]of [[-3.6,3.4],[-2.5,3.6],[2.7,3.8],[3.7,3.3],[3.7,-3.5],[-3.4,-4.2],...(siteId==='tidal_sluice'?[[-2.2,-4.1],[-1.2,-4.1],[.4,-4.1],[1.5,-4.1]]:[])]){
      if(!level.id.startsWith('stylized-island')){add('grass-large',x!,z!,.4,false,false);
      if(siteId==='tidal_sluice'||siteId==='village_pump')add('patch-grass-large',x!,z!,.2,false,false);}
    }
  }
  return result;
}
