import { traverse,type LevelData,type Vec3 } from './terrain';

// Shared by the actual fixed tick and the finite offline pulse diagnostics.
// No renderer, DOM, chain client, restoration or save authority here.
export const MOVEMENT=Object.freeze({yawDegrees:35,walkSpeed:2.6,briskSpeed:3.6,acceleration:14,tickSeconds:1/60});
export interface MovementInput {readonly right:number;readonly up:number;readonly brisk:boolean}
export interface MovingPose {readonly position:Vec3;readonly velocity:Vec3}
export function cameraRelativeMove(right:number,up:number):{x:number;z:number}{
  const length=Math.max(1,Math.hypot(right,up)),yaw=MOVEMENT.yawDegrees*Math.PI/180;
  return{x:(Math.cos(yaw)*right-Math.sin(yaw)*up)/length,z:(-Math.sin(yaw)*right-Math.cos(yaw)*up)/length};
}
export function movementTick(level:LevelData,pose:MovingPose,input:MovementInput,dt:number,restored:ReadonlySet<string>):MovingPose{
  const direction=cameraRelativeMove(input.right,input.up),speed=input.brisk?MOVEMENT.briskSpeed:MOVEMENT.walkSpeed;
  const approach=(value:number,target:number)=>value+Math.max(-MOVEMENT.acceleration*dt,Math.min(MOVEMENT.acceleration*dt,target-value));
  const next=traverse(level,pose.position,approach(pose.velocity.x,direction.x*speed)*dt,approach(pose.velocity.z,direction.z*speed)*dt,restored);
  return{position:next.position,velocity:{x:(next.position.x-pose.position.x)/dt,y:(next.position.y-pose.position.y)/dt,z:(next.position.z-pose.position.z)/dt}};
}
