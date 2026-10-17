import type { PublicRoute,RoutePoint } from '../content/route-contract';
import { dryStandingGround,sampleGround,type LevelData } from '../domain/terrain';
import { simulateLeg,standingDiagnostic,TIMING_BOUNDS,type RouteDiagnostic,type RouteFailure,type TimingProfile } from './corridor-steering';
import type { MovingPose } from '../domain/motion';

export interface MatrixFailure {readonly route:string;readonly direction:string;readonly segment:number;readonly offset:RoutePoint;readonly profile:TimingProfile|null;readonly failure:RouteFailure;readonly diagnostic:RouteDiagnostic;readonly pulses:number}
export interface MatrixOptions {readonly geometryOnly?:boolean;readonly profileLimit?:number;readonly routeIds?:readonly string[];readonly onRoute?:(id:string,counts:{samples:number;trials:number;failures:number})=>void}
export interface MatrixReport {readonly scope:string;readonly timing:typeof TIMING_BOUNDS;readonly samples:number;readonly trials:number;readonly chainedTrials:number;readonly failureCount:number;readonly classifications:Readonly<Record<string,number>>;readonly failures:readonly MatrixFailure[];readonly routes:readonly {id:string;segments:number;requires:readonly string[];acceptance:number;radius:number}[]}
const offsets=(radius:number):readonly RoutePoint[]=>[{x:0,z:0},...Array.from({length:8},(_,i)=>({x:Math.cos(i*Math.PI/4)*radius,z:Math.sin(i*Math.PI/4)*radius}))];
export function auditRouteMatrix(level:LevelData,routes:readonly PublicRoute[],options:MatrixOptions={}):MatrixReport{
  const profiles=TIMING_BOUNDS.holdScales.flatMap(holdScale=>TIMING_BOUNDS.latencyMs.map(latencyMs=>({holdScale,latencyMs}))).slice(0,options.profileLimit??Infinity);
  let samples=0,trials=0,chainedTrials=0,failureCount=0;
  const failures:MatrixFailure[]=[],classifications:Record<string,number>={};
  const included=routes.filter(r=>!options.routeIds||options.routeIds.includes(r.id));
  const fail=(failure:MatrixFailure)=>{failureCount++;classifications[failure.failure]=(classifications[failure.failure]??0)+1;if(failures.length<120)failures.push(failure);};
  const poseAt=(point:RoutePoint,parents:ReadonlySet<string>):MovingPose=>({position:{...point,y:sampleGround(level,point.x,point.z,parents)?.y??0},velocity:{x:0,y:0,z:0}});
  for(const route of included){
    const parents=new Set(route.requires); // Minimal physical prerequisites only.
    for(const reverse of [false,true]){
      const points=reverse?[...route.points].reverse():route.points,direction=reverse?'reverse':'forward';
      for(let segment=0;segment<points.length-1;segment++){
        const from=points[segment]!,to=points[segment+1]!,length=Math.hypot(to.x-from.x,to.z-from.z),count=Math.max(1,Math.ceil(length/.08));
        // Four-foot usable strip and complete accepted-arrival disks. Include
        // ordinary +/- .35m lateral room, not just exact road centrelines.
        for(let i=0;i<=count;i++)for(const offset of [0,-.35,.35]){
          const point={x:from.x+(to.x-from.x)*i/count-(to.z-from.z)/Math.max(length,1e-9)*offset,z:from.z+(to.z-from.z)*i/count+(to.x-from.x)/Math.max(length,1e-9)*offset};
          const pose=poseAt(point,parents),diagnostic=standingDiagnostic(level,pose.position,parents);samples++;
          if(diagnostic.failure)fail({route:route.id,direction,segment,offset:{x:offset,z:0},profile:null,failure:diagnostic.failure,diagnostic,pulses:0});
        }
        for(const offset of offsets(route.acceptance)){
          const point={x:from.x+offset.x,z:from.z+offset.z},initial=poseAt(point,parents),diagnostic=standingDiagnostic(level,initial.position,parents);samples++;
          if(diagnostic.failure){fail({route:route.id,direction,segment,offset,profile:null,failure:'invalid-initial',diagnostic,pulses:0});continue;}
          if(options.geometryOnly)continue;
          for(const profile of profiles){
            const trace=simulateLeg(level,initial,{from,to,radius:route.corridorRadius},route.acceptance,parents,profile);trials++;
            if(trace.failure)fail({route:route.id,direction,segment,offset,profile,failure:trace.failure,diagnostic:trace.diagnostics??standingDiagnostic(level,trace.pose.position,parents),pulses:trace.pulses});
          }
        }
      }
      if(!options.geometryOnly)for(const offset of offsets(route.acceptance))for(const profile of profiles){
        // Carry each settled, imperfect arrival into the next corner. A reset
        // to its nominal endpoint would conceal the original failure family.
        let actual=poseAt({x:points[0]!.x+offset.x,z:points[0]!.z+offset.z},parents);
        if(!dryStandingGround(level,actual.position,parents))continue;
        for(let segment=0;segment<points.length-1;segment++){
          const from=points[segment]!,to=points[segment+1]!;
          const trace=simulateLeg(level,actual,{from,to,radius:route.corridorRadius},route.acceptance,parents,profile);chainedTrials++;
          actual=trace.pose;
          if(trace.failure){fail({route:route.id,direction:`${direction}-chained`,segment,offset,profile,failure:trace.failure,diagnostic:trace.diagnostics??standingDiagnostic(level,actual.position,parents),pulses:trace.pulses});break;}
        }
      }
    }
    options.onRoute?.(route.id,{samples,trials,failures:failureCount});
  }
  return{scope:'Finite offline shared-floor/pulse matrix; no game instance or seeded progress; not an actual-input expedition',timing:TIMING_BOUNDS,samples,trials,chainedTrials,failureCount,classifications,failures,routes:included.map(r=>({id:r.id,segments:r.points.length-1,requires:r.requires,acceptance:r.acceptance,radius:r.corridorRadius}))};
}
