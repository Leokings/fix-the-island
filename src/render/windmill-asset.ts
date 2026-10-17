import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
export const WINDMILL_SHA256='d9eb34a14eec2784f7060372695281f59a6dfc091aadf061e7047ddbb291226a';
export async function loadWindmill():Promise<THREE.Group>{
  const asset=(await new GLTFLoader().loadAsync(new URL('../../assets/windmill/headland-windmill.glb',import.meta.url).href)).scene;
  for(const name of ['SailRoot','InputGearRoot','OutputGearRoot','GearCover','GroundHousing','StormDamage'])if(!asset.getObjectByName(name))throw new Error(`Windmill node missing: ${name}`);
  asset.traverse(object=>{if(object instanceof THREE.Mesh)object.castShadow=object.receiveShadow=true;});
  // Authored fit details are not a second puzzle or a preset successful ratio.
  asset.getObjectByName('InputGearRoot')!.visible=false;asset.getObjectByName('OutputGearRoot')!.visible=false;
  return asset;
}
