import * as THREE from 'three';
import type {RepairDressing} from '../../content/repair-dressing';
import type {RepairPropLibrary} from './repair-props';

export function sceneryVisible(placement:Pick<RepairDressing,'requires'|'untilRestored'>,restored:ReadonlySet<string>):boolean{
  return placement.requires.every(id=>restored.has(id))&&(!placement.untilRestored||!restored.has(placement.untilRestored));
}

/** Identical source transform for rendering and measured collision geometry. */
export function createSceneryInstance(library:RepairPropLibrary,placement:RepairDressing):{root:THREE.Group;prop:THREE.Group}{
  const root=new THREE.Group(),prop=library.create(placement.kind);
  const bounds=new THREE.Box3().setFromObject(prop),centre=bounds.getCenter(new THREE.Vector3());
  prop.position.set(-centre.x,-bounds.min.y,-centre.z);root.add(prop);
  root.position.set(placement.position.x,placement.position.y+(placement.kind==='patch-grass-large'?.015:0),placement.position.z);
  if(placement.normal)root.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(placement.normal.x,placement.normal.y,placement.normal.z));
  root.rotateY(placement.yaw??0);root.scale.setScalar(placement.scale??1);root.name=placement.id;root.userData.category='structure';
  root.updateMatrixWorld(true);return{root,prop};
}
