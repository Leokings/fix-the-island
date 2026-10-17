import{describe,expect,it}from'vitest';
import{cameraRelativeMove,MOVEMENT,movementTick}from'../../src/domain/motion';
import{sampleGround,dryStandingGround,type LevelData}from'../../src/domain/terrain';
import{planPulse,simulateLeg,simulatePulse,standingDiagnostic}from'../../src/input/corridor-steering';
import{PUBLIC_ROUTES,INSPECTION_STANCES}from'../../src/content/route-contract';
const floor:LevelData={id:'synthetic-pulse-test',spawn:{x:0,y:0,z:0},triangles:[
  {id:'flat-a',a:{x:-20,y:0,z:-20},b:{x:-20,y:0,z:20},c:{x:20,y:0,z:-20},biome:'test'},
  {id:'flat-b',a:{x:20,y:0,z:-20},b:{x:-20,y:0,z:20},c:{x:20,y:0,z:20},biome:'test'},
],obstacles:[],trees:[],visibleSiteIds:[],bounds:{minX:-20,maxX:20,minZ:-20,maxZ:20}};
const parents=new Set<string>(),still={position:floor.spawn,velocity:{x:0,y:0,z:0}};
describe('bounded engine-free real-input pulse contract',()=>{
  it('retains game motion constants and 35-degree keyboard basis',()=>{
    expect(MOVEMENT).toEqual({yawDegrees:35,walkSpeed:2.6,briskSpeed:3.6,acceleration:14,tickSeconds:1/60});
    expect(cameraRelativeMove(0,1).x).toBeCloseTo(-Math.sin(35*Math.PI/180));
    const tick=movementTick(floor,still,{right:1,up:0,brisk:false},1/60,parents);
    expect(tick.velocity.x).toBeCloseTo(14/60);expect(tick.velocity.z).toBeCloseTo(-14/60);
  });
  it('brakes completely after a pulse, unlike a 100ms release assumption',()=>{
    const result=simulatePulse(floor,still,{right:1,up:0,brisk:true},230,parents,{holdScale:1.2,latencyMs:80});
    expect(result.failure).toBeNull();expect(Math.hypot(result.pose.velocity.x,result.pose.velocity.z)).toBeLessThan(.02);
  });
  it('chooses real keys and converges from an imperfect settled arrival',()=>{
    const pose={position:{x:.1,y:0,z:-.1},velocity:{x:0,y:0,z:0}},corridor={from:{x:0,z:0},to:{x:3,z:2},radius:.65};
    const pulse=planPulse(floor,pose,{x:.7,z:.5},parents,corridor);expect(pulse?.keys.length).toBeGreaterThan(0);
    for(const holdScale of [.8,1,1.2])for(const latencyMs of [0,40,80]){
      const result=simulateLeg(floor,pose,corridor,.15,parents,{holdScale,latencyMs});
      expect(result.failure,JSON.stringify({holdScale,latencyMs,result})).toBeNull();expect(Math.hypot(result.pose.position.x-3,result.pose.position.z-2)).toBeLessThanOrEqual(.15);
    }
  });
  it('classifies a real solid obstacle without treating axis sliding as success',()=>{
    const blocked={...floor,obstacles:[{id:'solid',minX:.1,maxX:1,minZ:-1,maxZ:1}]};
    expect(standingDiagnostic(blocked,{x:.5,y:0,z:0},parents).failure).toBe('obstacle');
    expect(simulateLeg(blocked,still,{from:{x:0,z:0},to:{x:3,z:0},radius:.65},.15,parents,{holdScale:1,latencyMs:0}).failure).toBe('invalid-initial');
  });
  it('keeps source triangle order for overlapping floor samples',()=>{
    const raised=floor.triangles.map(t=>({...t,id:`raised-${t.id}`,a:{...t.a,y:1},b:{...t.b,y:1},c:{...t.c,y:1}}));
    const overlap={...floor,triangles:[...raised,...floor.triangles]};
    expect(sampleGround(overlap,0,0)?.y).toBe(1);expect(sampleGround({...floor,triangles:[...floor.triangles,...raised]},0,0)?.y).toBe(0);
    expect(dryStandingGround(overlap,{x:0,y:1,z:0})).not.toBeNull();
  });
  it('provides every site stance, both branch choices and the complete restored west return',()=>{
    expect(Object.keys(INSPECTION_STANCES)).toHaveLength(8);expect(PUBLIC_ROUTES.cisternBranch.points[1]).toEqual({x:5,z:-4.5});
    expect(PUBLIC_ROUTES.headland.points).not.toContainEqual({x:8,z:-2});
    expect(PUBLIC_ROUTES.westReturn.requires).toContain('upland_waterworks');expect(PUBLIC_ROUTES.westReturn.points.at(-1)).toEqual({x:-38,z:44});
  });
});
