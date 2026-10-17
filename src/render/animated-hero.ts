import * as THREE from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import type {RigPose} from './hero-rig';

export const ROBOT_SHA256='047f5e5fb3bb6d378bd1df16ca6137f2a596c99b3a1b5690b4020c05aaf6f319';
/** Authored clips only. No bone rotation, ankle compensation or procedural gait. */
export class AnimatedHero {
  readonly root=new THREE.Group();
  private readonly mixer:THREE.AnimationMixer;
  private readonly actions=new Map<string,THREE.AnimationAction>();
  private active='Idle';
  private readonly skin:THREE.Object3D;
  constructor(source:GLTF,tint?:THREE.ColorRepresentation){
    this.root.name='restoration-robot';this.skin=clone(source.scene);this.root.add(this.skin);
    this.skin.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=object.receiveShadow=true;const materials=Array.isArray(object.material)?object.material:[object.material];const copies=materials.map(material=>{const copy=material.clone();if(tint&&copy instanceof THREE.MeshStandardMaterial&&copy.name==='Main')copy.color.set(tint);return copy;});object.material=Array.isArray(object.material)?copies:copies[0]!;}});
    this.mixer=new THREE.AnimationMixer(this.skin);
    for(const clip of source.animations)this.actions.set(clip.name,this.mixer.clipAction(clip));
    for(const name of ['Idle','Walking','Running'])if(!this.actions.has(name))throw new Error(`Authored robot animation missing: ${name}`);
    this.actions.get('Idle')!.play();this.mixer.update(0);this.root.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(this.skin),height=bounds.max.y-bounds.min.y;
    if(!Number.isFinite(height)||height<=0)throw new Error('Robot bounds are invalid');
    const scale=1.65/height;this.skin.scale.multiplyScalar(scale);this.skin.position.y-=bounds.min.y*scale;this.root.updateMatrixWorld(true);
  }
  update(pose:RigPose,dt:number):void{
    if(pose.paused)return;
    const next=pose.speed>3.05?'Running':pose.speed>.08?'Walking':pose.work&&this.actions.has('Punch')?'Punch':'Idle';
    if(next!==this.active){const previous=this.actions.get(this.active)!,action=this.actions.get(next)!;action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();previous.crossFadeTo(action,.16,false);this.active=next;}
    const action=this.actions.get(this.active)!;
    action.timeScale=this.active==='Walking'?THREE.MathUtils.clamp(pose.speed/2.6,.65,1.3):this.active==='Running'?THREE.MathUtils.clamp(pose.speed/3.6,.75,1.3):1;
    this.mixer.update(Math.min(dt,.1));
  }
  private ghosts:THREE.Mesh[]=[];
  /** A flat see-through outline drawn over buildings while the restorer is hidden behind one. */
  setOccluded(occluded:boolean):void{
    if(!this.ghosts.length&&occluded){
      const material=new THREE.MeshBasicMaterial({color:'#fff1cf',transparent:true,opacity:.5,depthTest:false,depthWrite:false});
      const sources:THREE.Mesh[]=[];this.skin.traverse(object=>{if(object instanceof THREE.Mesh&&!object.userData.ghost)sources.push(object);});
      for(const object of sources){
        // Skinned parts share the skeleton; rigid parts ride the same bone with the same local transform.
        const ghost=object instanceof THREE.SkinnedMesh?new THREE.SkinnedMesh(object.geometry,material):new THREE.Mesh(object.geometry,material);
        if(ghost instanceof THREE.SkinnedMesh&&object instanceof THREE.SkinnedMesh)ghost.bind(object.skeleton,object.bindMatrix);
        else{ghost.position.copy(object.position);ghost.quaternion.copy(object.quaternion);ghost.scale.copy(object.scale);}
        ghost.renderOrder=50;ghost.frustumCulled=false;ghost.userData.ghost=true;object.parent?.add(ghost);this.ghosts.push(ghost);
      }
    }
    for(const ghost of this.ghosts)ghost.visible=occluded;
  }
  attachTool(tool:THREE.Object3D):void{const hand=this.skin.getObjectByName('Palm1R')??this.skin.getObjectByName('Palm1.R');if(hand){hand.updateWorldMatrix(true,false);tool.scale.divide(hand.getWorldScale(new THREE.Vector3()));hand.add(tool);}}
  diagnostics():Readonly<Record<string,unknown>>{return{sha256:ROBOT_SHA256,authored:true,animation:this.active,clipTime:this.actions.get(this.active)!.time,clips:[...this.actions.keys()],height:1.65};}
  dispose():void{this.mixer.stopAllAction();this.mixer.uncacheRoot(this.skin);this.skin.traverse(object=>{if(object instanceof THREE.Mesh)for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();});}
}
let robot:Promise<GLTF>|null=null;
export const loadAnimatedHero=():Promise<GLTF>=>robot??=new GLTFLoader().loadAsync(new URL('../../assets/robot/RobotExpressive.glb',import.meta.url).href);
