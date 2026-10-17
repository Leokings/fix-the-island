import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export const RESTORER_SHA256='c0fdba913057c656b3b9a1e46f590691a09a22a2932574f71147d6a98046c5bb';
const normalize=(name:string)=>name.replace(/[^a-z0-9]/gi,'').toLowerCase();
interface Joint {bone:THREE.Bone;bind:THREE.Quaternion;position:THREE.Vector3;x:THREE.Vector3;y:THREE.Vector3;z:THREE.Vector3}
export interface RigPose {readonly phase:number;readonly speed:number;readonly work:boolean;readonly paused:boolean;readonly seconds:number}
export class RestorerRig {
  readonly root:THREE.Group;
  private readonly joints=new Map<string,Joint>();
  private stride=0;private workBlend=0;
  constructor(source:THREE.Object3D,tint?:THREE.ColorRepresentation){
    this.root=new THREE.Group();this.root.name='gated-restorer';const skin=clone(source);this.root.add(skin);skin.updateMatrixWorld(true);
    skin.traverse(object=>{
      if(object instanceof THREE.Mesh){
        object.castShadow=object.receiveShadow=true;object.frustumCulled=false;
        const materials=Array.isArray(object.material)?object.material:[object.material];
        const instances=materials.map(material=>{const copy=material.clone();if(tint&&copy instanceof THREE.MeshStandardMaterial&&copy.name==='Restorer_Fabric')copy.color.set(tint);return copy;});
        object.material=Array.isArray(object.material)?instances:instances[0]!;
      }
      if(object instanceof THREE.Bone){
        const parentBind=object.parent?.getWorldQuaternion(new THREE.Quaternion())??new THREE.Quaternion(),inverse=parentBind.invert();
        this.joints.set(normalize(object.name),{bone:object,bind:object.quaternion.clone(),position:object.position.clone(),x:new THREE.Vector3(1,0,0).applyQuaternion(inverse),y:new THREE.Vector3(0,1,0).applyQuaternion(inverse),z:new THREE.Vector3(0,0,1).applyQuaternion(inverse)});
      }
    });
    for(const name of ['hips','upper_leg.L','upper_leg.R','leg.L','leg.R','foot.L','foot.R','upper_arm.L','upper_arm.R','forearm.L','forearm.R'])if(!this.joints.has(normalize(name)))throw new Error(`Restorer bone missing: ${name}`);
  }
  private pose(name:string,x=0,y=0,z=0):void{
    const joint=this.joints.get(normalize(name));if(!joint)return;
    const delta=new THREE.Quaternion().setFromAxisAngle(joint.x,x);
    delta.premultiply(new THREE.Quaternion().setFromAxisAngle(joint.y,y));
    delta.premultiply(new THREE.Quaternion().setFromAxisAngle(joint.z,z));
    joint.bone.quaternion.copy(delta.multiply(joint.bind));
  }
  update(pose:RigPose,dt:number,diagnostic:'bind'|'arms-bind'|'no-contact'|null=null):void{
    const blend=1-Math.exp(-Math.min(dt,.1)/.12);
    if(!pose.paused){this.stride+=(Math.min(1,pose.speed/2.6)-this.stride)*blend;this.workBlend+=((pose.work?1:0)-this.workBlend)*blend;}
    for(const joint of this.joints.values()){joint.bone.quaternion.copy(joint.bind);joint.bone.position.copy(joint.position);}
    // Renderer-only isolation. The caller exposes this only in development;
    // no probe changes the source GLB, movement, saved state or approval.
    if(diagnostic==='bind'){this.root.updateMatrixWorld(true);this.root.userData.pose=this.diagnostics();return;}
    const sin=Math.sin(pose.phase),left=-sin*.38*this.stride,right=-left;
    const leftKnee=Math.max(0,-sin)*.52*this.stride,rightKnee=Math.max(0,sin)*.52*this.stride;
    this.pose('upper_leg.L',left);this.pose('upper_leg.R',right);
    this.pose('leg.L',leftKnee);this.pose('leg.R',rightKnee);
    this.pose('foot.L',-left-leftKnee);this.pose('foot.R',-right-rightKnee);
    const stroke=Math.sin(pose.seconds*7),work=this.workBlend;
    if(diagnostic!=='arms-bind'){
      // The approved A-pose skin folds at the previous .58 rad rest drop.
      // Keep a smaller rest offset; authored shoulder weights remain unchanged.
      this.pose('upper_arm.L',-left*.55-work*.7,0,-.18);
      this.pose('upper_arm.R',-right*.55-work*(.8+stroke*.24),0,.18);
      this.pose('forearm.L',work*.5);this.pose('forearm.R',work*(1.1+stroke*.22));
    }
    this.pose('spine',-.04*this.stride-work*.08);this.pose('chest',0,sin*.035*this.stride);this.pose('head',work*.08);
    const hips=this.joints.get('hips')!;hips.bone.position.y=hips.position.y+.014*Math.cos(pose.phase*2)*this.stride;
    // Keep the lower ankle's bind clearance over the shared standing floor.
    // This is render-pose contact compensation, never a player-position write.
    this.root.updateMatrixWorld(true);
    const inverse=this.root.matrixWorld.clone().invert();
    const ankle=(name:string)=>this.joints.get(normalize(name))!.bone.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse).y;
    const lower=Math.min(ankle('foot.L'),ankle('foot.R'));
    if(diagnostic!=='no-contact')hips.bone.position.y+=.17-lower;this.root.updateMatrixWorld(true);
    this.root.userData.pose=this.diagnostics();
  }
  attachTool(tool:THREE.Object3D):void{this.joints.get(normalize('hand.R'))?.bone.add(tool);}
  diagnostics():Readonly<Record<string,unknown>>{
    const read=(name:string)=>this.joints.get(normalize(name))!.bone.quaternion.toArray();
    return{sha256:RESTORER_SHA256,skinned:true,joints:this.joints.size,metreScale:this.root.scale.toArray(),stride:this.stride,work:this.workBlend,leftLeg:read('upper_leg.L'),rightLeg:read('upper_leg.R'),leftFoot:read('foot.L'),rightFoot:read('foot.R')};
  }
  dispose():void{this.root.traverse(object=>{if(object instanceof THREE.Mesh)for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();});}
}
let sourcePromise:Promise<THREE.Object3D>|null=null;
export function loadRestorer():Promise<THREE.Object3D>{
  return sourcePromise??=new GLTFLoader().loadAsync(new URL('../../assets/hero/restorer.glb',import.meta.url).href).then(gltf=>gltf.scene);
}
