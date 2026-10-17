import type { RoutePoint } from '../content/route-contract';
import { cameraRelativeMove,MOVEMENT,movementTick,type MovingPose,type MovementInput } from '../domain/motion';
import { collidingObstacles,dryStandingGround,sampleGround,type LevelData,type Vec3 } from '../domain/terrain';

export type RouteFailure='invalid-initial'|'centre-gap'|'foot-gap'|'step'|'slope'|'obstacle'|'outside-corridor'|'nonconvergence';
export interface Corridor {readonly from:RoutePoint;readonly to:RoutePoint;readonly radius:number}
export interface TimingProfile {readonly holdScale:number;readonly latencyMs:number}
export const TIMING_BOUNDS=Object.freeze({holdScales:[.8,1,1.2],latencyMs:[0,40,80],releaseMs:350});
export interface Pulse {readonly input:MovementInput;readonly keys:readonly string[];readonly holdMs:number;readonly predicted:MovingPose;readonly minClearance:number}
export interface RouteDiagnostic {readonly failure:RouteFailure|null;readonly position:Vec3;readonly supports:readonly {name:string;sample:ReturnType<typeof sampleGround>}[];readonly obstacles:readonly string[]}
export function standingDiagnostic(level:LevelData,position:Vec3,restored:ReadonlySet<string>):RouteDiagnostic{
  const offsets=[['centre',0,0],['+x',.28,0],['-x',-.28,0],['+z',0,.28],['-z',0,-.28]] as const;
  const supports=offsets.map(([name,x,z])=>({name,sample:sampleGround(level,position.x+x,position.z+z,restored)}));
  const centre=supports[0]!.sample;
  const obstacles=collidingObstacles(level,position,position,restored).map(o=>o.id);
  const failure:RouteFailure|null=!centre?'centre-gap':supports.some(s=>!s.sample)?'foot-gap':supports.some(s=>s.sample!.normal.y<Math.cos(38*Math.PI/180))?'slope':supports.some(s=>Math.abs(s.sample!.y-centre.y)>.22)?'step':obstacles.length?'obstacle':!dryStandingGround(level,position,restored)?'invalid-initial':null;
  return{failure,position,supports,obstacles};
}
export function distanceFromCorridor(point:RoutePoint,corridor:Corridor):number{
  const x=corridor.to.x-corridor.from.x,z=corridor.to.z-corridor.from.z,length=x*x+z*z;
  const t=length?Math.max(0,Math.min(1,((point.x-corridor.from.x)*x+(point.z-corridor.from.z)*z)/length)):0;
  return Math.hypot(point.x-corridor.from.x-x*t,point.z-corridor.from.z-z*t);
}
export function simulatePulse(level:LevelData,initial:MovingPose,input:MovementInput,holdMs:number,restored:ReadonlySet<string>,profile:TimingProfile,corridor?:Corridor):{pose:MovingPose;failure:RouteFailure|null;steps:number}{
  let pose=initial,steps=0;
  const heldTicks=Math.ceil((holdMs*profile.holdScale+profile.latencyMs)/1000/MOVEMENT.tickSeconds);
  const releasedTicks=Math.ceil(TIMING_BOUNDS.releaseMs/1000/MOVEMENT.tickSeconds);
  for(let tick=0;tick<heldTicks+releasedTicks;tick++){
    const movement=tick<heldTicks?input:{right:0,up:0,brisk:false},next=movementTick(level,pose,movement,MOVEMENT.tickSeconds,restored);
    // Any blocked sweep or axis fallback is diagnostic failure, not successful
    // accidental wall sliding. The actual game still retains safe sliding.
    const direction=cameraRelativeMove(movement.right,movement.up),speed=movement.brisk?MOVEMENT.briskSpeed:MOVEMENT.walkSpeed;
    const accel=MOVEMENT.acceleration*MOVEMENT.tickSeconds;
    const vx=pose.velocity.x+Math.max(-accel,Math.min(accel,direction.x*speed-pose.velocity.x));
    const vz=pose.velocity.z+Math.max(-accel,Math.min(accel,direction.z*speed-pose.velocity.z));
    const wanted={x:pose.position.x+vx*MOVEMENT.tickSeconds,y:next.position.y,z:pose.position.z+vz*MOVEMENT.tickSeconds};
    if(Math.hypot(next.position.x-wanted.x,next.position.z-wanted.z)>1e-7){
      const reason=standingDiagnostic(level,wanted,restored).failure;
      const ground=sampleGround(level,wanted.x,wanted.z,restored);
      return{pose:next,failure:reason??(ground&&Math.abs(ground.y-pose.position.y)>.22?'step':'obstacle'),steps};
    }
    if(corridor&&distanceFromCorridor(next.position,corridor)>corridor.radius)return{pose:next,failure:'outside-corridor',steps};
    pose=next;steps++;
  }
  return{pose,failure:null,steps};
}
export function standingClearance(level:LevelData,position:Vec3,restored:ReadonlySet<string>,maximum=.8):number{
  // Finite conservative radial probe after the .28m footprint expansion.
  for(let radius=.05;radius<=maximum;radius+=.05)for(let angle=0;angle<16;angle++){
    if(!dryStandingGround(level,{x:position.x+Math.cos(angle*Math.PI/8)*radius,y:position.y,z:position.z+Math.sin(angle*Math.PI/8)*radius},restored))return Math.max(0,radius-.05);
  }
  return maximum;
}
const directions=Object.freeze([
  {right:0,up:1,keys:['KeyW']},{right:1,up:1,keys:['KeyD','KeyW']},
  {right:1,up:0,keys:['KeyD']},{right:1,up:-1,keys:['KeyD','KeyS']},
  {right:0,up:-1,keys:['KeyS']},{right:-1,up:-1,keys:['KeyA','KeyS']},
  {right:-1,up:0,keys:['KeyA']},{right:-1,up:1,keys:['KeyA','KeyW']},
]);
export function planPulse(level:LevelData,pose:MovingPose,goal:RoutePoint,restored:ReadonlySet<string>,corridor:Corridor):Pulse|null{
  const dx=goal.x-pose.position.x,dz=goal.z-pose.position.z,distance=Math.hypot(dx,dz);
  // Tight turns always walk. Braking is simulated through complete release,
  // and every candidate must stay safe at the declared long timing bound.
  const speeds=distance>1.5?[true,false]:[false];
  const choices=[...directions].sort((a,b)=>{
    const aa=cameraRelativeMove(a.right,a.up),bb=cameraRelativeMove(b.right,b.up);
    return(bb.x*dx+bb.z*dz)-(aa.x*dx+aa.z*dz);
  }).slice(0,3);
  const candidates:{input:MovementInput;keys:readonly string[];holdMs:number;score:number;predicted:MovingPose}[]=[];
  // Rank free-motion candidates cheaply, then run exact four-foot/collision
  // sweeps on each timing extreme before using one. This keeps the exhaustive
  // finite matrix bounded without changing simulation or floor semantics.
  const endpoints=(input:MovementInput,holdMs:number,profile:TimingProfile):MovingPose=>{
    const dt=MOVEMENT.tickSeconds,accel=MOVEMENT.acceleration*dt,direction=cameraRelativeMove(input.right,input.up),speed=input.brisk?MOVEMENT.briskSpeed:MOVEMENT.walkSpeed;
    let x=pose.position.x,z=pose.position.z,vx=pose.velocity.x,vz=pose.velocity.z;
    const held=Math.ceil((holdMs*profile.holdScale+profile.latencyMs)/1000/dt),release=Math.ceil(TIMING_BOUNDS.releaseMs/1000/dt);
    for(let tick=0;tick<held+release;tick++){
      vx+=Math.max(-accel,Math.min(accel,(tick<held?direction.x*speed:0)-vx));
      vz+=Math.max(-accel,Math.min(accel,(tick<held?direction.z*speed:0)-vz));x+=vx*dt;z+=vz*dt;
    }
    return{position:{x,y:pose.position.y,z},velocity:{x:vx,y:0,z:vz}};
  };
  const extremes=[{holdScale:.8,latencyMs:0},{holdScale:1,latencyMs:0},{holdScale:1.2,latencyMs:80}];
  for(const direction of choices)for(const brisk of speeds)for(const holdMs of [16,30,45,80,120,180,230]){
    const input={right:direction.right,up:direction.up,brisk};
    let worst=0,total=0,predicted:MovingPose=pose;
    // Geometry/timing envelope, not a promise about every host's latency.
    for(const profile of extremes){
      const endpoint=endpoints(input,holdMs,profile);
      const remaining=Math.hypot(endpoint.position.x-goal.x,endpoint.position.z-goal.z);
      worst=Math.max(worst,remaining);total+=remaining;
      if(profile.holdScale===1)predicted=endpoint;
    }
    const score=worst*.45+total/3*.55;
    if(score<distance-.0005)candidates.push({input,keys:direction.keys,holdMs,score,predicted});
  }
  for(const candidate of candidates.sort((a,b)=>a.score-b.score)){
    let safe=true,predicted=candidate.predicted;
    for(const profile of extremes){
      const trace=simulatePulse(level,pose,candidate.input,candidate.holdMs,restored,profile,corridor);
      if(trace.failure){safe=false;break;}
      if(profile.holdScale===1)predicted=trace.pose;
    }
    if(safe)return{input:candidate.input,keys:candidate.keys,holdMs:candidate.holdMs,predicted,minClearance:standingClearance(level,pose.position,restored)};
  }
  return null;
}

export interface LegTrace {readonly pose:MovingPose;readonly failure:RouteFailure|null;readonly pulses:number;readonly minimumClearance:number;readonly diagnostics:RouteDiagnostic|null}
export function simulateLeg(level:LevelData,initial:MovingPose,corridor:Corridor,acceptance:number,restored:ReadonlySet<string>,profile:TimingProfile):LegTrace{
  const bad=standingDiagnostic(level,initial.position,restored);
  if(bad.failure)return{pose:initial,failure:'invalid-initial',pulses:0,minimumClearance:0,diagnostics:bad};
  let pose=initial,minimumClearance=.8;
  const distance=Math.hypot(corridor.to.x-corridor.from.x,corridor.to.z-corridor.from.z),count=Math.max(1,Math.ceil(distance/.9));let next=1;
  const budget=Math.ceil(distance*30)+60;
  for(let pulses=0;pulses<budget;pulses++){
    const goal={x:corridor.from.x+(corridor.to.x-corridor.from.x)*next/count,z:corridor.from.z+(corridor.to.z-corridor.from.z)*next/count};
    if(Math.hypot(pose.position.x-goal.x,pose.position.z-goal.z)<=acceptance){if(next===count)return{pose,failure:null,pulses,minimumClearance,diagnostics:null};next++;continue;}
    const pulse=planPulse(level,pose,goal,restored,corridor);
    if(!pulse)return{pose,failure:'nonconvergence',pulses,minimumClearance,diagnostics:standingDiagnostic(level,pose.position,restored)};
    minimumClearance=Math.min(minimumClearance,pulse.minClearance);
    const result=simulatePulse(level,pose,pulse.input,pulse.holdMs,restored,profile,corridor);
    if(result.failure)return{pose:result.pose,failure:result.failure,pulses,minimumClearance,diagnostics:standingDiagnostic(level,result.pose.position,restored)};
    pose=result.pose;
  }
  return{pose,failure:'nonconvergence',pulses:budget,minimumClearance,diagnostics:standingDiagnostic(level,pose.position,restored)};
}
