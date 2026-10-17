import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {occludesView,createIslandCutaway} from '../../src/render/island-cutaway';
import {repairStateAppearance} from '../../src/render/restoration-feedback';
import {routineSaveNotice} from '../../src/ui/game-hud';
import type {LevelData} from '../../src/domain/terrain';

describe('bounded presentation changes preserve authority and visible contact',()=>{
  it('cuts only foreground overlap, not background or side objects',()=>{
    const eye=new THREE.Vector3(0,12,12),view={point:new THREE.Vector3(0,1,0),radius:1};
    expect(occludesView(new THREE.Box3(new THREE.Vector3(-2,2,2),new THREE.Vector3(2,8,6)),eye,view)).toBe(true);
    expect(occludesView(new THREE.Box3(new THREE.Vector3(-2,1,-8),new THREE.Vector3(2,8,-3)),eye,view)).toBe(false);
    expect(occludesView(new THREE.Box3(new THREE.Vector3(8,1,2),new THREE.Vector3(10,8,6)),eye,view)).toBe(false);
  });
  it('does not move vertices or clip the widest terrain component',()=>{
    const positions=[-20,0,-20,20,0,-20,20,0,20, -1,0,2,1,0,2,0,8,4];
    const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    const group=new THREE.Group();group.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial()));
    const level:LevelData={id:'test',spawn:{x:0,y:0,z:0},triangles:[{id:'floor',a:{x:-20,y:0,z:-20},b:{x:20,y:0,z:-20},c:{x:20,y:0,z:20},biome:'test'}],obstacles:[],trees:[],visibleSiteIds:[],bounds:{minX:-20,maxX:20,minZ:-20,maxZ:20}};
    const visibility=createIslandCutaway(group,level);
    visibility.update(new THREE.Vector3(0,12,12),[{point:new THREE.Vector3(0,1,0),radius:2}]);
    expect(Array.from(geometry.getAttribute('position').array)).toEqual(positions);
    expect([0,1,2].map(i=>geometry.getAttribute('islandCutaway').getX(i))).toEqual([0,0,0]);
    expect(geometry.getAttribute('islandContactTop').getX(3)).toBeGreaterThanOrEqual(1.65);
    visibility.update(new THREE.Vector3(0,12,12),[],false);
    expect(Array.from(geometry.getAttribute('islandCutaway').array)).toEqual([0,0,0,0,0,0]);
  });
  it('never displays a pending/revised repair as working',()=>{
    for(const phase of ['damaged','pending','revision','restoring']as const)expect(repairStateAppearance({phase,crew:'working'}).label).not.toBe('Working');
    expect(repairStateAppearance({phase:'pending',crew:'working'}).label).toBe('In review');
    expect(repairStateAppearance({phase:'restored',crew:'none'}).label).toBe('Working');
  });
  it('quiets only routine save successes, never review or actionable errors',()=>{
    expect(routineSaveNotice('Local practice saved')).toBe(true);
    for(const notice of ['Save failed. Keep this page open.','Unknown wallet activity. Recover the original hash.','Reviews pending','Local storage unavailable'])expect(routineSaveNotice(notice)).toBe(false);
  });
});
