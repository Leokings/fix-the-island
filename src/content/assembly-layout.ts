import type { SiteFixture } from '../genlayer';
import type { Vec3 } from '../domain/terrain';
import { COMPOSITION_STANCES } from './route-contract';

// Presentation only: fixed-stock fixture sockets get physical mounting points.
// No success conditions or graph requirements live in this file.
const layouts: Readonly<Record<string, Readonly<Record<string, readonly [number,number,number]>>>> = {
  pier_hoist:{crank:[-1.4,0.7,0.4],pulley:[0,2.0,0],boom:[0,2.6,-0.4],rope:[0.5,1.1,0.2],guard:[-0.65,2.0,0],weight_a:[-1.0,1.0,-0.4],weight_b:[1.0,1.0,-0.4]},
  // Direct-pump line along the front; quiet-pump mount/housing wrap the pump body;
  // the rain-cistern kit steps down a raised back row (GAME-DESIGN §7).
  village_pump:{screen:[-1.6,0.6,0],inlet:[-1,0.8,0],pump:[-0.3,1,0],relief:[0.5,1,0],outlet:[1.1,0.8,0],trunk:[1.7,0.6,0],bypass:[0.5,0.5,0.7],
    mount:[-0.3,0.45,0.05],housing:[-0.3,1.3,-0.05],
    roof:[-1.45,1.85,-0.6],gutter:[-0.75,1.6,-0.6],leaf_screen:[-0.2,1.38,-0.6],first_flush:[0.38,1.2,-0.6],cistern:[1.1,1.0,-0.55],filter:[1.72,0.8,-0.55],
    delivery_valve:[1.4,0.6,0.62],village_trunk:[1.9,0.45,0.62],overflow_pipe:[-0.2,0.5,0.75],soakaway:[-1.1,0.22,0.75]},
  tidal_sluice:{source:[-1.4,0.5,-0.3],bank_baffle:[-0.5,0.5,0.7],creek_baffle:[0,0.5,-0.3],nursery_gate:[0,0.5,-1],creek:[1.5,0.4,-0.3],nursery:[1.2,0.4,-1],rack:[-1.4,0.6,0.9]},
  // Bridge: an upstream truss — braces rise from each shoe to the ends of the top beam.
  creek_bridge:{shoe_left:[-4.6,0.1,0],shoe_right:[4.6,0.1,0],deck_left:[-2.4,0.2,0],deck_right:[2.4,0.2,0],beam:[0,1.4,-1.45],brace_left:[-3.2,0.8,-1.45],brace_right:[3.2,0.8,-1.45],rail:[0,1.1,0]},
  coast_windmill:{shaft:[0.66,1.2,1.895],driver:[1.12,1.2,1.895],driven:[1.65,1.2,1.895],coupling:[2.05,1.2,1.895],generator:[1.75,.86,1.82],guard:[.58,1.16,1.87]},
  woodland_pathlight:{source:[-1.5,0.7,0],fuse:[-0.9,0.9,0],regulator:[-0.3,0.9,0],lamp:[0.7,1.75,0],return:[1.5,0.7,0],shield:[0.7,2.25,0]},
  upland_waterworks:{cistern:[-1.5,1.5,0],filter:[-0.7,1.1,0],splitter:[0.1,0.9,0],village_valve:[0.7,0.7,0.55],habitat_valve:[0.7,0.7,-0.7],village:[1.6,0.4,0.55],habitat:[1.6,0.4,-0.7],overflow:[-1.5,0.6,0.8]},
  ridge_beacon:{source:[-1.5,0.5,0],fuse:[-0.9,0.75,0],regulator:[-0.2,0.75,0],reflector:[0.5,1.55,-0.2],lens:[1.0,1.55,0.2],shield:[1.0,2.1,0.2],plinth:[0.5,0.4,-0.2]},
};
export function socketPosition(siteId:string,slotId:string):Vec3 {
  const v=layouts[siteId]?.[slotId];if(!v) throw new Error(`Unmapped physical socket: ${siteId}/${slotId}`);
  return {x:v[0],y:v[1],z:v[2]};
}
// Authored pump models carry their pipe ends on the machine itself, so the
// plumbing joins body to body instead of floating in front of the board.
type Ports=Readonly<Record<string,Readonly<Record<string,readonly [number,number,number]>>>>;
const pumpPorts:Ports={
  screen:{out:[0.22,0,0]},inlet:{in:[-0.23,0,0],out:[0.23,0,0]},outlet:{in:[-0.23,0,0],out:[0.23,0,0]},
  pump:{in:[-0.38,-0.05,0],out:[0.38,0.05,0],mount:[0,-0.44,0],housing:[0,0.3,0]},
  relief:{in:[-0.21,0,0],out:[0.21,0,0],bypass:[0,-0.16,0.17]},trunk:{in:[-0.21,0,0]},bypass:{in:[0,0.1,0]},
  mount:{out:[0,-0.02,0]},housing:{cover:[0,0.12,0]},
  roof:{out:[0.5,-0.2,0]},gutter:{in:[-0.3,0.03,0],out:[0.3,-0.03,0]},leaf_screen:{in:[-0.12,0.12,0],out:[0.1,-0.12,0]},
  first_flush:{in:[-0.06,0.12,0],out:[0.18,-0.05,0]},cistern:{in:[-0.14,0.52,0],out:[0.37,-0.6,0],overflow:[-0.1,0.3,0.36]},
  filter:{in:[-0.15,0.16,0],out:[0,-0.26,0.1]},delivery_valve:{in:[0,0,-0.25],out:[0.12,-0.16,0.16]},village_trunk:{in:[-0.18,0,0]},
  overflow_pipe:{in:[0.34,0.02,0],out:[-0.34,-0.02,0]},soakaway:{in:[0.12,0.12,0]},
};
// Landing hoist: rope from the winch drum over the sheave to the boom; chains up from each weight.
const hoistPorts:Ports={
  crank:{out:[0,0.13,0]},pulley:{in:[-0.16,-0.05,0],out:[0.12,0.14,-0.05],guard:[0,0.2,0.08]},
  boom:{in:[0.3,-0.09,0.06],anchor:[0.9,-0.09,0.06],weight_a:[-1.0,-0.24,0],weight_b:[1.0,-0.24,0]},
  rope:{anchor:[0,1.2,-0.5]},guard:{cover:[0.65,0.3,0]},weight_a:{force:[0,1.38,0]},weight_b:{force:[0,1.38,0]},
};
const sluicePorts:Ports={
  source:{creek:[0.6,0.02,0],nursery:[0.28,0.02,-0.52],bank:[0.26,0.02,0.52],rack:[0,0.25,0.3]},bank_baffle:{in:[0,-0.04,-0.25]},
  creek_baffle:{in:[-0.3,-0.04,0],out:[0.3,-0.04,0]},nursery_gate:{in:[-0.3,-0.04,0],out:[0.3,-0.04,0]},creek:{in:[-0.35,0,0]},nursery:{in:[-0.32,-0.02,0]},rack:{mount:[0,0.35,0]},
};
const waterworksPorts:Ports={
  cistern:{out:[0.58,-0.93,0],overflow:[0,-0.6,0.5]},filter:{in:[-0.24,0.3,0],out:[0.24,0.05,0]},splitter:{in:[-0.28,0,0],village:[0.06,0,0.28],habitat:[0.06,0,-0.28]},
  village_valve:{in:[-0.23,0,0],out:[0.23,0,0]},habitat_valve:{in:[-0.23,0,0],out:[0.23,0,0]},village:{in:[-0.16,0.02,0]},habitat:{in:[-0.2,0.02,0]},overflow:{in:[0,0,-0.1]},
};
const pathlightPorts:Ports={
  source:{out:[0.12,-0.1,0.16],return:[-0.12,-0.1,0.16]},fuse:{in:[-0.15,0,0],out:[0.15,0,0]},regulator:{in:[-0.15,0,0],out:[0.15,0,0]},
  lamp:{in:[-0.06,-0.9,0.06],out:[0.06,-0.9,0.06],shade:[0,0.26,0]},return:{in:[-0.13,-0.3,0],out:[0.13,-0.3,0]},shield:{mount:[0,0.16,0]},
};
const beaconPorts:Ports={
  source:{out:[0.12,0.1,0.16],return:[-0.12,0.1,0.16]},fuse:{in:[-0.15,0,0],out:[0.15,0,0]},regulator:{in:[-0.15,0,0],out:[0.15,0,0]},
  reflector:{seat:[0,-1.0,0],out:[0,0,0.3]},lens:{in:[-0.21,-0.1,0],out:[0.21,-0.1,0],seat:[-0.18,0.05,-0.15],shield:[0,0.22,0]},shield:{mount:[0,-0.05,-0.1]},plinth:{mount:[0,0.11,0]},
};
const bridgePorts:Ports={
  shoe_left:{deck:[0.35,0.05,0],brace:[0.3,0.1,-1.45]},shoe_right:{deck:[-0.35,0.05,0],brace:[-0.3,0.1,-1.45]},
  deck_left:{shoe:[-2.25,0,0],join:[2.3,0,0]},deck_right:{shoe:[2.25,0,0],join:[-2.3,0,0]},
  brace_left:{shoe:[-1.1,-0.6,0],beam:[1.1,0.6,0]},brace_right:{shoe:[1.1,-0.6,0],beam:[-1.1,0.6,0]},
  beam:{left:[-2.1,0,0],right:[2.1,0,0],rail:[0,0.1,0.3]},rail:{mount:[0,0,-1.15]},
};
// Windmill: links run between gear hubs on the front face; the gears themselves mesh.
const windmillPorts:Ports={
  shaft:{out:[0.33,0,0.08]},driver:{in:[0,0,0.12],out:[0,0,0.12],guard:[0,0.12,0.12]},driven:{in:[0,0,0.12],out:[0,0,0.12]},
  coupling:{in:[-0.2,0,0.08],out:[0.2,0,0.08]},generator:{in:[-0.28,0,0.08]},guard:{cover:[0.54,0.16,0.14]},
};
const AUTHORED_PORTS:Readonly<Record<string,Ports>>={coast_windmill:windmillPorts,creek_bridge:bridgePorts,village_pump:pumpPorts,pier_hoist:hoistPorts,tidal_sluice:sluicePorts,upland_waterworks:waterworksPorts,woodland_pathlight:pathlightPorts,ridge_beacon:beaconPorts};
// Ports that touch (a pipe end on its neighbour, a chain on its hook) are nudged apart once,
// just enough that each is its own tap target. Pipes, ropes and wires still join between them.
const MIN_PORT_GAP:Readonly<Record<string,number>>={creek_bridge:.45};
const separated=new Map<string,Map<string,Vec3>>();
function separatedPorts(siteId:string):Map<string,Vec3> {
  const cached=separated.get(siteId);if(cached)return cached;
  const out=new Map<string,Vec3>(),ports=AUTHORED_PORTS[siteId];separated.set(siteId,out);if(!ports)return out;
  const items:{key:string;socket:Vec3;p:Vec3}[]=[];
  for(const [slot,list] of Object.entries(ports))for(const [port,o] of Object.entries(list)){const b=socketPosition(siteId,slot);items.push({key:`${slot}.${port}`,socket:b,p:{x:b.x+o[0],y:b.y+o[1],z:b.z+o[2]}});}
  const gap=MIN_PORT_GAP[siteId]??.32;
  for(let pass=0;pass<60;pass++)for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
    const a=items[i]!,b=items[j]!;let dx=b.p.x-a.p.x,dy=b.p.y-a.p.y,dz=b.p.z-a.p.z,d=Math.hypot(dx,dy,dz);
    if(d>=gap)continue;
    // Coincident ends separate toward their own parts (or sideways for two ports of one part).
    const apart=d;
    if(d<1e-4){dx=b.socket.x-a.socket.x;dy=b.socket.y-a.socket.y;dz=b.socket.z-a.socket.z;d=Math.hypot(dx,dy,dz);if(d<1e-4){dx=1;dy=0;dz=0;d=1;}}
    // Move each end half the shortfall along the unit direction between them.
    const push=(gap-apart)/2/d;
    a.p={x:a.p.x-dx*push,y:a.p.y-dy*push,z:a.p.z-dz*push};b.p={x:b.p.x+dx*push,y:b.p.y+dy*push,z:b.p.z+dz*push};
  }
  for(const item of items)out.set(item.key,item.p);
  return out;
}
export function portPosition(site:SiteFixture,slotId:string,optionId:string,portId:string):Vec3 {
  const base=socketPosition(site.id,slotId), ports=site.options.find((o)=>o.id===optionId)?.ports ?? [];
  const authored=separatedPorts(site.id).get(`${slotId}.${portId}`);
  if(authored)return authored;
  const index=ports.findIndex((port)=>port.id===portId);
  return {x:base.x+(index-(ports.length-1)/2)*0.25,y:base.y+0.35,z:base.z+0.4};
}
export const COMPOSITION_SCENES=Object.freeze([
  {ref:'ref-01',siteId:'pier_hoist',name:'workshop junction',stance:COMPOSITION_STANCES['ref-01']},
  {ref:'ref-02',siteId:'coast_windmill',name:'windmill interaction',stance:COMPOSITION_STANCES['ref-02']},
  {ref:'ref-03',siteId:'creek_bridge',name:'bridge crossing',stance:COMPOSITION_STANCES['ref-03']},
  {ref:'ref-04',siteId:'tidal_sluice',name:'reedbed shore',stance:COMPOSITION_STANCES['ref-04']},
  {ref:'ref-05',siteId:'upland_waterworks',name:'cool upland',stance:COMPOSITION_STANCES['ref-05']},
  {ref:'ref-06',siteId:'pier_hoist',name:'pier workshop',stance:COMPOSITION_STANCES['ref-06']},
]);
