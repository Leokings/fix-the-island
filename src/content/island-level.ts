import type { LevelData, Vec3, WalkTriangle, RouteGate } from '../domain/terrain';
import { SITE_PLAN } from './site-plan';
import { broadenSharedLand } from './coherent-land';
import { BEACON_SPIRE, BRIDGE_SERVICE, BRIDGE_RAIL, SERVICE_BOARD, SHELTER, SHELTER_POST, SLUICE_WALK, TEMPORARY_TOWER, servicePadRadius, shelterPosition } from './service-layout';

// Stage B greybox land is a real connected network of wide banks, pads and
// ramps. The same vertices render and support walking; water is never floor.
const p = (x: number, z: number, y: number): Vec3 => ({ x, y, z });
export const ROUTES = Object.freeze([
  { id: 'shore', width: 3.4, nodes: [p(-38,44,2),p(-12,44,2),p(12,48,2),p(30,38,2)] },
  { id: 'pump', width: 3.2, nodes: [p(-38,44,2),p(-30,32,3),p(-18,22,4)] },
  { id: 'approach', width: 3.0, nodes: [p(-18,22,4),p(-12,12,5),p(-8,4,6),p(-5,-2,6)] },
  { id: 'headland', width: 3.0, nodes: [p(5,-2,6),p(20,-8,8),p(40,-14,9)] },
  // The light's entry terrace is level with its enlarged service bay. Its
  // ascent belongs on the long branch, not inside the short board approach.
  { id: 'light', width: 3.2, nodes: [p(5,-2,6),p(12,-18,12),p(18,-24,12),p(8,-38,18)] },
  { id: 'cistern', width: 3.2, nodes: [p(5,-2,6),p(4,-20,11),p(-8,-30,14),p(-26,-34,17)] },
  { id: 'return', width: 3.0, nodes: [p(-26,-34,17),p(-36,-18,12),p(-38,0,7),p(-32,24,3),p(-30,32,3)] },
  { id: 'beacon', width: 3.2, nodes: [p(8,-38,18),p(12,-44,20),p(12,-52,22)] },
]);
const triangles: WalkTriangle[] = [], banks: [Vec3, Vec3][] = [];
const biome = (z: number) => z >= 18 ? 'coast' : z > -24 ? 'woodland' : 'upland';
const triangle = (id: string, a: Vec3, b: Vec3, c: Vec3, requires: readonly string[] = []) => {
  // Clipping a polygon on an existing edge can emit a zero-area fan member.
  if(Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))<1e-9)return;
  triangles.push({ id, a, b, c, biome: biome(a.z), requires });
};
const disc = (centre: Vec3, radius: number, id: string) => {
  for (let i=0; i<16; i++) {
    const a = p(centre.x+Math.cos(i*Math.PI/8)*radius,centre.z+Math.sin(i*Math.PI/8)*radius,centre.y);
    const b = p(centre.x+Math.cos((i+1)*Math.PI/8)*radius,centre.z+Math.sin((i+1)*Math.PI/8)*radius,centre.y);
    triangle(id,centre,b,a); banks.push([a,b]);
  }
};
const isSite = (v: Vec3) => SITE_PLAN.some((site) => site.id !== 'creek_bridge' && Math.hypot(site.position.x-v.x,site.position.z-v.z)<0.1);
for (const site of SITE_PLAN) if (site.id !== 'creek_bridge') disc(site.position, servicePadRadius(site.id), `pad:${site.id}`);
for(const site of SITE_PLAN.filter((s)=>['pier_hoist','upland_waterworks'].includes(s.id))) {
  const bay=site.id==='pier_hoist'?{x0:-6,x1:-1.3,z0:-0.6,z1:2.6}:{x0:0,x1:5.2,z0:-3.4,z1:0};
  const corners=[p(site.position.x+bay.x0,site.position.z+bay.z0,site.position.y),p(site.position.x+bay.x1,site.position.z+bay.z0,site.position.y),p(site.position.x+bay.x0,site.position.z+bay.z1,site.position.y),p(site.position.x+bay.x1,site.position.z+bay.z1,site.position.y)];
  triangle(`workshop-foundation:${site.id}`,corners[0]!,corners[2]!,corners[1]!);triangle(`workshop-foundation:${site.id}`,corners[1]!,corners[2]!,corners[3]!);
}
disc(p(-38,44,2),3.0,'landing');
for (const route of ROUTES) {
  route.nodes.forEach((node) => { if (!isSite(node)) disc(node,route.width*0.61,`join:${route.id}`); });
  for (let j=0;j<route.nodes.length-1;j++) {
    const a=route.nodes[j]!, b=route.nodes[j+1]!, length=Math.hypot(b.x-a.x,b.z-a.z);
    const px=-(b.z-a.z)/length*route.width/2, pz=(b.x-a.x)/length*route.width/2;
    // The pier apron overlaps the first pump approach: keep that shared join
    // level, then ramp. Other pads leave sufficient run for <=38° slopes.
    const siteRadius=(node:Vec3)=>servicePadRadius(SITE_PLAN.find((site)=>Math.hypot(site.position.x-node.x,site.position.z-node.z)<0.1)!.id);
    // Flatten through the complete pad/foundation projection. Increasing a
    // pad without moving the ramp boundary creates two rendered heights.
    const startFlat=route.id==='pump'&&j===0?10:route.id==='pump'&&j===1?3:isSite(a)?siteRadius(a):route.width*0.61;
    const endFlat=route.id==='cistern'&&j===2?7:isSite(b)?siteRadius(b):route.width*0.61;
    const headlandHeight=(x:number,z:number)=>{
      const shared=6+Math.max(0,-z-4)*0.3,t=Math.max(0,Math.min(1,(x-9)/9));
      return shared+(8-shared)*t;
    };
    const vertex=(distance:number,side:number):Vec3 => {
      const t=distance/length, h=Math.max(0,Math.min(1,(distance-startFlat)/(length-startFlat-endFlat)));
      const x=a.x+(b.x-a.x)*t+px*side,z=a.z+(b.z-a.z)*t+pz*side;
      let y=a.y+(b.y-a.y)*h;
      if(j===0&&route.id==='headland')y=headlandHeight(x,z);
      if(j===0&&(route.id==='light'||route.id==='cistern')) {
        // Both first branches physically overlap. A shared world-Z height
        // plane (including their edges, not just the centre) joins the east
        // shoe until z=-10, where the corridors are already separated.
        const endZ=b.z+endFlat;
        y=z>=-4?6:z>=-10?6+(-z-4)*0.3:7.8+(b.y-7.8)*Math.max(0,Math.min(1,(-z-10)/(-endZ-10)));
      }
      return {x,z,y};
    };
    const segments=Math.ceil(length/0.6);
    // Include exact slope boundaries rather than interpolating a kink inside
    // a strip triangle. Every overlapping flat patch then has the same Y.
    const cuts=[...Array.from({length:segments+1},(_,k)=>k/segments*length),startFlat,length-endFlat].filter((d)=>d>=0&&d<=length).sort((a,b)=>a-b);
    if(j===0&&(route.id==='light'||route.id==='cistern')) {
      for(const z of [-4,-10,b.z+endFlat]) for(const side of [-1,1]) {
        const distance=(z-a.z-pz*side)/(b.z-a.z)*length;
        if(distance>0&&distance<length)cuts.push(distance);
      }
      cuts.sort((a,b)=>a-b);
    }
    for(let k=0;k<cuts.length-1;k++) {
      const d0=cuts[k]!,d1=cuts[k+1]!;if(d1-d0<1e-8)continue;
      const aa=vertex(d0,-1),bb=vertex(d0,1),cc=vertex(d1,-1),dd=vertex(d1,1);
      const requirements=route.id==='approach'&&j===2?['village_pump','tidal_sluice']:
        route.id==='light'&&j===2?['woodland_pathlight']:
        route.id==='beacon'?['woodland_pathlight','upland_waterworks']:
        route.id==='return'?['upland_waterworks']:[];
      const id=`route:${route.id}:${j}:${k}`;
      if(j===0&&['headland','light','cistern'].includes(route.id)) {
        // Cut across shared plane boundaries as well as across the strip: triangles spanning
        // a height kink would otherwise give each overlapping branch its own
        // interpolation. All polygons here share the same planar boundaries.
        let polygons:Vec3[][]=[[aa,bb,dd,cc]];
        const boundaries:{axis:'x'|'z';value:number}[]=route.id==='headland'?[
          {axis:'z',value:-4},{axis:'x',value:9},{axis:'x',value:18},
        ]:[{axis:'z',value:-4},{axis:'z',value:-10},{axis:'z',value:b.z+endFlat}];
        for(const {axis,value:boundary} of boundaries) {
          const clip=(polygon:Vec3[],above:boolean):Vec3[]=>{
            const out:Vec3[]=[];
            for(let i=0;i<polygon.length;i++) {
              const from=polygon[i]!,to=polygon[(i+1)%polygon.length]!,inside=(v:Vec3)=>above?v[axis]>=boundary:v[axis]<=boundary;
              if(inside(from))out.push(from);
              if(inside(from)!==inside(to)) {
                const t=(boundary-from[axis])/(to[axis]-from[axis]);
                out.push(p(axis==='x'?boundary:from.x+(to.x-from.x)*t,axis==='z'?boundary:from.z+(to.z-from.z)*t,0));
              }
            }
            return out;
          };
          polygons=polygons.flatMap((polygon)=>[clip(polygon,true),clip(polygon,false)]).filter((polygon)=>polygon.length>=3);
        }
        const height=(z:number)=>z>=-4?6:z>=-10?6+(-z-4)*0.3:7.8+(b.y-7.8)*Math.max(0,Math.min(1,(-z-10)/(-b.z-endFlat-10)));
        for(const polygon of polygons) {
          const vertices=polygon.map((v)=>p(v.x,v.z,route.id==='headland'?headlandHeight(v.x,v.z):height(v.z)));
          for(let i=1;i<vertices.length-1;i++)triangle(id,vertices[0]!,vertices[i]!,vertices[i+1]!,requirements);
        }
      }else {triangle(id,aa,bb,cc,requirements);triangle(id,bb,dd,cc,requirements);}
      banks.push([aa,cc],[dd,bb]);
    }
  }
}
// Permanent landing apron joins the hoist to the public footpath.
const apron=[p(-42,37,2),p(-32.8,37,2),p(-42,48,2),p(-32.8,48,2)];
triangle('pier-apron',apron[0]!,apron[2]!,apron[1]!);triangle('pier-apron',apron[1]!,apron[2]!,apron[3]!);
// A west-anchored dead-end workwalk exposes the actual bridge joints. It does
// not reach the east bank and cannot bypass the missing approved crossing.
const workwalk=[p(BRIDGE_SERVICE.minX,BRIDGE_SERVICE.minZ,6),p(BRIDGE_SERVICE.maxX,BRIDGE_SERVICE.minZ,6),p(BRIDGE_SERVICE.minX,BRIDGE_SERVICE.maxZ,6),p(BRIDGE_SERVICE.maxX,BRIDGE_SERVICE.maxZ,6)],stock=['pier_hoist','village_pump','tidal_sluice'];
triangle('bridge-service',workwalk[0]!,workwalk[2]!,workwalk[1]!,stock);triangle('bridge-service',workwalk[1]!,workwalk[2]!,workwalk[3]!,stock);
for(let x=-5;x<5;x+=0.5) {
  const req=Math.abs(x+0.25)<3?['creek_bridge']:[];
  const a=p(x,-3.35,6),b=p(x,-0.65,6),c=p(x+0.5,-3.35,6),d=p(x+0.5,-0.65,6);
  triangle('bridge-deck',a,b,c,req);triangle('bridge-deck',b,d,c,req);
}
const gates: RouteGate[] = [
  {id:'bridge-flood',position:p(-7.0,1.6,6),requires:['village_pump','tidal_sluice'],diagnosis:'Drain the western approach: repair Spring Pump and Reedbed Sluice.',kind:'flood'},
  {id:'bridge-gap',position:p(0,-2,6),requires:['creek_bridge'],diagnosis:'A broken span. Repair both shoes, deck join and opposing braces.',kind:'gap'},
  {id:'woodland-latch',position:p(14.0,-29.6,13.7),requires:['woodland_pathlight'],diagnosis:'The maintenance latch needs the shielded Fern Path Light.',kind:'gate'},
  {id:'ridge-overflow',position:p(9.5,-41,18.5),requires:['upland_waterworks','woodland_pathlight'],diagnosis:'Ridge overflow and latch: restore Ridge Cistern and Fern Path Light.',kind:'flood'},
  {id:'west-return',position:p(-34.0,-21,13),requires:['upland_waterworks'],diagnosis:'The west return is waterlogged until Ridge Cistern distributes flow.',kind:'flood'},
];
// Placeholder crowns mark the six composition slots. They are not final art.
const trees: Vec3[]=[];
for(const site of SITE_PLAN) for(let i=0;i<(site.id==='pier_hoist'?10:18);i++) {
  const angle=i*2.399963, radius=4.8+(i%3)*1.05;
  const x=site.position.x+Math.cos(angle)*radius,z=site.position.z+Math.sin(angle)*radius;
  if(ROUTES.some((route)=>route.nodes.some((v,j)=> {
    const end=route.nodes[j+1];if(!end)return false;
    const dx=end.x-v.x,dz=end.z-v.z,t=Math.max(0,Math.min(1,((x-v.x)*dx+(z-v.z)*dz)/(dx*dx+dz*dz)));
    return Math.hypot(x-v.x-t*dx,z-v.z-t*dz)<route.width/2+0.7;
  }))) continue;
  trees.push(p(x,z,site.position.y-0.6));
}
export const ROUTE_FOUNDATION: LevelData = Object.freeze({
  id:'island-stage-b-v1',spawn:p(-38,44,2),bounds:{minX:-64,maxX:64,minZ:-64,maxZ:64},
  triangles:Object.freeze(triangles),banks:Object.freeze(banks),trees:Object.freeze(trees),gates:Object.freeze(gates),
  visibleSiteIds:Object.freeze(SITE_PLAN.map((s)=>s.id)),
  obstacles:Object.freeze([
    ...SITE_PLAN.filter((s)=>s.id!=='creek_bridge'&&s.id!=='coast_windmill').map((s)=>({id:s.id,minX:s.position.x-SERVICE_BOARD.width/2,maxX:s.position.x+SERVICE_BOARD.width/2,minZ:s.position.z-SERVICE_BOARD.depth/2,maxZ:s.position.z+SERVICE_BOARD.depth/2})),
    // Metre-scale gated GLB: tower/foundation core, cabinet and entry stairs.
    // Narrow slices fit the round tower, rather than blocking empty AABB corners.
    ...Array.from({length:14},(_,i)=>{
      const z0=-1.55+i*3.1/14,z1=z0+3.1/14,closest=Math.min(Math.abs(z0),Math.abs(z1)),width=Math.sqrt(1.55**2-closest**2);
      return{id:i===0?'coast_windmill':`windmill-foundation-${i}`,minX:40-width,maxX:40+width,minZ:-14+z0,maxZ:-14+z1};
    }),
    {id:'windmill-cabinet',minX:40.45,maxX:42.265,minZ:-12.56,maxZ:-11.735},
    {id:'windmill-entry-steps',minX:39.42,maxX:40.58,minZ:-12.55,maxZ:-11.735},
    ...SITE_PLAN.filter((s)=>['pier_hoist','upland_waterworks'].includes(s.id)).flatMap((s)=>{
      const at=shelterPosition(s.id),x=s.position.x+at.x,z=s.position.z+at.z;
      return [
        {id:`shelter:${s.id}`,minX:x-SHELTER.width/2,maxX:x+SHELTER.width/2,minZ:z-SHELTER.depth/2,maxZ:z+SHELTER.depth/2},
        ...[-SHELTER_POST.x,SHELTER_POST.x].map((offset)=>({id:`shelter-post:${s.id}:${offset}`,minX:x+offset-SHELTER_POST.width/2,maxX:x+offset+SHELTER_POST.width/2,minZ:z+SHELTER.depth/2-SHELTER_POST.depth/2,maxZ:z+SHELTER.depth/2+SHELTER_POST.depth/2})),
      ];
    }),
    ...SITE_PLAN.filter((s)=>s.id==='ridge_beacon').map((s)=>({id:'beacon-spire',minX:s.position.x+BEACON_SPIRE.x-BEACON_SPIRE.width/2,maxX:s.position.x+BEACON_SPIRE.x+BEACON_SPIRE.width/2,minZ:s.position.z+BEACON_SPIRE.z-BEACON_SPIRE.depth/2,maxZ:s.position.z+BEACON_SPIRE.z+BEACON_SPIRE.depth/2})),
    ...SITE_PLAN.filter((s)=>s.id==='tidal_sluice').map((s)=>({id:'sluice-boardwalk',minX:s.position.x+SLUICE_WALK.x-SLUICE_WALK.width/2,maxX:s.position.x+SLUICE_WALK.x+SLUICE_WALK.width/2,minZ:s.position.z+SLUICE_WALK.z-SLUICE_WALK.depth/2,maxZ:s.position.z+SLUICE_WALK.z+SLUICE_WALK.depth/2})),
    ...trees.map((v,i)=>({id:`tree-${i}`,minX:v.x-0.16,maxX:v.x+0.16,minZ:v.z-0.16,maxZ:v.z+0.16})),
    {id:'bridge-rail-north',minX:BRIDGE_RAIL.minX,maxX:BRIDGE_RAIL.maxX,minZ:BRIDGE_RAIL.northZ-BRIDGE_RAIL.depth/2,maxZ:BRIDGE_RAIL.northZ+BRIDGE_RAIL.depth/2},{id:'bridge-rail-south',minX:BRIDGE_RAIL.minX,maxX:BRIDGE_RAIL.maxX,minZ:BRIDGE_RAIL.southZ-BRIDGE_RAIL.depth/2,maxZ:BRIDGE_RAIL.southZ+BRIDGE_RAIL.depth/2},
  ]),
});
export const ISLAND_LEVEL:LevelData=broadenSharedLand(ROUTE_FOUNDATION);
