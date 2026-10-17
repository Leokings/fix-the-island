import {describe,expect,it} from 'vitest';
import {ISLAND_LEVEL,ROUTES} from '../../src/content/island-level';
import {REPAIR_SCENARIOS} from '../../src/genlayer';
import {dryStandingGround,sampleGround,traverse,type Vec3} from '../../src/domain/terrain';
import {cameraRelativeMove} from '../../src/domain/world';
import {PUBLIC_ROUTES} from '../../src/content/route-contract';
const all=new Set(REPAIR_SCENARIOS.map((site)=>site.id)); // Diagnostic support only; not gameplay/capture state.
function eightWayLeg(start:Vec3,end:Vec3,parents:ReadonlySet<string>):Vec3 {
  expect(dryStandingGround(ISLAND_LEVEL,start,parents)).not.toBeNull();
  let pose=start,vx=0,vz=0,nextWaypoint=1;const dt=1/60,yaw=35*Math.PI/180,count=Math.max(1,Math.ceil(Math.hypot(end.x-start.x,end.z-start.z)/1.35));
  for(let tick=0;tick<1800;tick++) {
    const waypoint={x:start.x+(end.x-start.x)*nextWaypoint/count,z:start.z+(end.z-start.z)*nextWaypoint/count};
    const dx=waypoint.x-pose.x,dz=waypoint.z-pose.z,length=Math.hypot(dx,dz);
    if(length<.13){if(nextWaypoint===count)return pose;nextWaypoint++;continue;}
    const right=Math.cos(yaw)*dx-Math.sin(yaw)*dz,up=-Math.sin(yaw)*dx-Math.cos(yaw)*dz;
    const direction=cameraRelativeMove(Math.abs(right)>Math.abs(up)*.414?Math.sign(right):0,Math.abs(up)>Math.abs(right)*.414?Math.sign(up):0),speed=length>1?3.6:2.6;
    const approach=(value:number,target:number)=>value+Math.max(-14*dt,Math.min(14*dt,target-value));
    const next=traverse(ISLAND_LEVEL,pose,approach(vx,direction.x*speed)*dt,approach(vz,direction.z*speed)*dt,parents);
    expect(dryStandingGround(ISLAND_LEVEL,next.position,parents)).not.toBeNull();
    vx=(next.position.x-pose.x)/dt;vz=(next.position.z-pose.z)/dt;pose=next.position;
  }
  throw new Error(`Diagnostic eight-way leg stalled at ${JSON.stringify(pose)} toward ${JSON.stringify(end)}`);
}
describe('shared visible floor seams with unchanged .22m/38-degree safety',()=>{
  for(const forward of [true,false])it(`pier apron / pump ramp traverses ${forward?'outward':'homeward'} with all four supports`,()=>{
    // The actual reported seam pose is past the hoist's permanent footprint.
    // A direct spawn centreline crosses its boom; this test does not disable it.
    const apron={x:-34.3063,y:2,z:38.362};
    const start=forward?apron:ROUTES[1]!.nodes[1]!,end=forward?ROUTES[1]!.nodes[1]!:apron;
    const length=Math.hypot(end.x-start.x,end.z-start.z),steps=Math.ceil(length/0.045);let pose:Vec3=start;
    for(let i=1;i<=steps;i++){const x=start.x+(end.x-start.x)*i/steps,z=start.z+(end.z-start.z)*i/steps,next=traverse(ISLAND_LEVEL,pose,x-pose.x,z-pose.z);expect(next.position.x).toBeCloseTo(x,6);expect(next.position.z).toBeCloseTo(z,6);expect(dryStandingGround(ISLAND_LEVEL,next.position)).not.toBeNull();pose=next.position;}
    expect(pose.y).toBeCloseTo(end.y);
  });
  it('stitches east-shoe light/cistern overlap at the reported footprint',()=>{
    const ground=sampleGround(ISLAND_LEVEL,4.8144044,-5.3407202,all)!;
    for(const [x,z]of [[.28,0],[-.28,0],[0,.28],[0,-.28]])expect(Math.abs(sampleGround(ISLAND_LEVEL,4.8144044+x!,-5.3407202+z!,all)!.y-ground.y)).toBeLessThanOrEqual(.22);
  });
  it('retains collision at the north rail tip rather than weakening it for a route',()=>{
    const pose={x:4.95,y:6,z:-2.95};
    expect(traverse(ISLAND_LEVEL,pose,0,-0.15,all).position).toEqual(pose);
  });
  it('the west-anchored bridge workwalk is usable but never supplies the missing crossing',()=>{
    const parents=new Set(['pier_hoist','village_pump','tidal_sluice']);
    expect(sampleGround(ISLAND_LEVEL,1,0)).toBeNull();expect(sampleGround(ISLAND_LEVEL,0,-2,parents)).toBeNull();
    expect(sampleGround(ISLAND_LEVEL,2.2,0,parents)).toBeNull();
    const points=[{x:-5.7,y:6,z:-2},{x:-5.7,y:6,z:0.45},{x:1,y:6,z:0.45}];
    for(const path of [points,[...points].reverse()]) {
      let pose=path[0]!;
      for(const end of path.slice(1)) {
        const start=pose,steps=Math.ceil(Math.hypot(end.x-start.x,end.z-start.z)/.035);
        for(let i=1;i<=steps;i++) {
          const x=start.x+(end.x-start.x)*i/steps,z=start.z+(end.z-start.z)*i/steps,next=traverse(ISLAND_LEVEL,pose,x-pose.x,z-pose.z,parents);
          expect(next.position.x).toBeCloseTo(x,6);expect(next.position.z).toBeCloseTo(z,6);expect(dryStandingGround(ISLAND_LEVEL,next.position,parents)).not.toBeNull();pose=next.position;
        }
      }
    }
  });
  for(const xJitter of [-.35,0,.35])for(const zJitter of [-.35,0,.35])it(`eight-way bridge workwalk supports +/- .35m arrival ${xJitter},${zJitter} both directions`,()=>{
    const parents=new Set(['pier_hoist','village_pump','tidal_sluice']);
    const outward=eightWayLeg({x:-5.7+xJitter,y:6,z:.45+zJitter},{x:1,y:6,z:.45},parents);
    expect(Math.hypot(outward.x-1,outward.z-.45)).toBeLessThan(.13);
    const home=eightWayLeg({x:1+xJitter,y:6,z:.45+zJitter},{x:-5.7,y:6,z:.45},parents);
    expect(Math.hypot(home.x+5.7,home.z-.45)).toBeLessThan(.13);
  });
  it('the reported workwalk entry pose has continuous four-foot support to the new service stance',()=>{
    const parents=new Set(['pier_hoist','village_pump','tidal_sluice']);let pose={x:-4.126720513823064,y:6,z:-.11597975466118791};
    const start=pose,end={x:1,y:6,z:.45},steps=Math.ceil(Math.hypot(end.x-start.x,end.z-start.z)/.035);
    for(let i=1;i<=steps;i++){const x=start.x+(end.x-start.x)*i/steps,z=start.z+(end.z-start.z)*i/steps,next=traverse(ISLAND_LEVEL,pose,x-pose.x,z-pose.z,parents);expect(next.position.x).toBeCloseTo(x,6);expect(next.position.z).toBeCloseTo(z,6);expect(dryStandingGround(ISLAND_LEVEL,next.position,parents)).not.toBeNull();pose=next.position;}
  });
  it('reported path-light outer-pad failure poses now have visible turning-bay support',()=>{
    const from={x:17.078043904303396,y:12,z:-21.099045546245275};
    expect(dryStandingGround(ISLAND_LEVEL,from,all)).not.toBeNull();
    // d93/059 failed here on the smaller pad. The repaired visible bay now
    // supports this pose; unchanged .28/.22/38 rules still reject water.
    expect(dryStandingGround(ISLAND_LEVEL,{x:17.12,y:12,z:-21.09},all)).not.toBeNull();
    expect(dryStandingGround(ISLAND_LEVEL,{x:18,y:12,z:-18.9},all)).not.toBeNull();
    expect(dryStandingGround(ISLAND_LEVEL,{x:58,y:12,z:-18.9},all)).toBeNull();
    const end=eightWayLeg(from,{x:18,y:12,z:-21.8},all);
    expect(Math.hypot(end.x-18,end.z+21.8)).toBeLessThan(.13);
  });
  for(const xJitter of [-.35,0,.35])for(const zJitter of [-.35,0,.35])it(`path-light service pad eight-way arrival ${xJitter},${zJitter} both directions`,()=>{
    const outward=eightWayLeg({x:16.6+xJitter,y:12,z:-21.8+zJitter},{x:18,y:12,z:-21.8},all);
    expect(Math.hypot(outward.x-18,outward.z+21.8)).toBeLessThan(.13);
    const home=eightWayLeg({x:18+xJitter,y:12,z:-21.8+zJitter},{x:16.6,y:12,z:-21.8},all);
    expect(Math.hypot(home.x-16.6,home.z+21.8)).toBeLessThan(.13);
  });
  it('actual path-light public detour clears the visible board with unchanged collision',()=>{
    let pose={x:16.6,y:12,z:-21.8};
    for(const end of PUBLIC_ROUTES.lightBypass.points.slice(2)){const y=sampleGround(ISLAND_LEVEL,end.x,end.z,all)!.y;pose=eightWayLeg(pose,{...end,y},all);}
    expect(Math.hypot(pose.x-16.7,pose.z+26.3)).toBeLessThan(.13);
    expect(dryStandingGround(ISLAND_LEVEL,{x:18,y:12,z:-24},all)).toBeNull();
    // The old X=20.2 shortcut crosses the now-matched 3.9m visible board.
    expect(dryStandingGround(ISLAND_LEVEL,{x:20.2,y:12,z:-24},all)).toBeNull();
  });
  for(const jitter of [-0.2,0,0.2])for(const zJitter of [-0.2,0,0.2])it(`east-bank rail detour supports arrival jitter ${jitter},${zJitter} in both directions`,()=>{
    const arrival={x:5+jitter,y:6,z:-2+zJitter},points=[arrival,{x:6.1,y:6,z:-2},{x:6.1,y:6,z:-4},{x:4,y:11,z:-20}];
    for(const path of [points,[...points].reverse()]) {
      let pose=path[0]!;
      for(const end of path.slice(1)) {
        const start=pose,steps=Math.ceil(Math.hypot(end.x-start.x,end.z-start.z)/.035);
        for(let i=1;i<=steps;i++) {
          const x=start.x+(end.x-start.x)*i/steps,z=start.z+(end.z-start.z)*i/steps,next=traverse(ISLAND_LEVEL,pose,x-pose.x,z-pose.z,all);
          expect(next.position.x).toBeCloseTo(x,6);expect(next.position.z).toBeCloseTo(z,6);
          expect(dryStandingGround(ISLAND_LEVEL,next.position,all)).not.toBeNull();pose=next.position;
        }
      }
    }
  });
  for(const route of ROUTES)it(`${route.id}: all centreline four-foot supports are dry and continuous`,()=>{
    for(let j=0;j<route.nodes.length-1;j++){const a=route.nodes[j]!,b=route.nodes[j+1]!,steps=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.05);
      for(let i=0;i<=steps;i++){const x=a.x+(b.x-a.x)*i/steps,z=a.z+(b.z-a.z)*i/steps,ground=sampleGround(ISLAND_LEVEL,x,z,all);expect(ground,`${route.id}:${j}:${i} centre`).not.toBeNull();
        for(const [dx,dz]of [[.28,0],[-.28,0],[0,.28],[0,-.28]]){const support=sampleGround(ISLAND_LEVEL,x+dx!,z+dz!,all);expect(support,`${route.id}:${j}:${i} foot`).not.toBeNull();expect(Math.abs(support!.y-ground!.y),`${route.id}:${j}:${i} height`).toBeLessThanOrEqual(.22);expect(support!.normal.y).toBeGreaterThanOrEqual(Math.cos(38*Math.PI/180));}
      }
    }
  });
});
