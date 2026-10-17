// Stage B service clearances shared by visible greyboxes and collision data.
// No puzzle rules, final meshes or authority live here.
export const SHELTER = Object.freeze({x:2.7,z:-1.8,width:3.8,depth:1.8,height:2.4});
export const shelterPosition=(siteId:string)=>siteId==='pier_hoist'?{x:-3.8,z:0.8}:{x:SHELTER.x,z:SHELTER.z};
export const TEMPORARY_TOWER = Object.freeze({x:3,z:-1,width:1.6,depth:1.6,height:4.6});
export const BRIDGE_SERVICE = Object.freeze({minX:-6.5,maxX:1.8,minZ:-0.7,maxZ:1.25,y:6});

// Dimensions of the current renderer placeholders, in metres. Roofs/sails
// are overhead; the shelter posts extend 0.09m beyond the shell's front.
export const SERVICE_BOARD = Object.freeze({width:3.9,depth:1.7,height:0.18,y:0.18});
export const SHELTER_POST = Object.freeze({width:0.18,depth:0.18,x:1.7});
export const BRIDGE_RAIL = Object.freeze({minX:-5,maxX:5,northZ:-3.4,southZ:-0.6,depth:0.2});
export const BEACON_SPIRE = Object.freeze({x:0,z:-1.8,width:1.6,depth:1.6,height:3.3});
export const SLUICE_WALK = Object.freeze({x:0,z:-2.6,width:3.4,depth:1.8,height:0.16,y:0.12});
export const servicePadRadius=(siteId:string)=>
  siteId==='coast_windmill'?5.2:
  ['village_pump','tidal_sluice','woodland_pathlight','upland_waterworks'].includes(siteId)?4.8:3.3;
