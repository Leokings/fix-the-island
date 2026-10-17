import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {measuredSceneryColliders} from '../../src/render/imported-world';
import {createSceneryInstance,sceneryVisible} from '../../src/render/environment/scenery-instance';
import {collidingObstacles,dryStandingGround,type LevelData} from '../../src/domain/terrain';
import type {RepairPropLibrary} from '../../src/render/environment/repair-props';

const level:LevelData={id:'visible-scenery-test',spawn:{x:0,y:0,z:0},bounds:{minX:-20,maxX:20,minZ:-20,maxZ:20},visibleSiteIds:[],trees:[],obstacles:[],triangles:[{id:'floor-a',biome:'test',a:{x:-20,y:0,z:-20},b:{x:-20,y:0,z:20},c:{x:20,y:0,z:-20}},{id:'floor-b',biome:'test',a:{x:20,y:0,z:-20},b:{x:-20,y:0,z:20},c:{x:20,y:0,z:20}}]};
describe('imported scenery stays visible and physically honest',()=>{
  it('leaves the space beneath a canopy walkable and collides with its actual posts',()=>{
    const canopy=new THREE.Group();
    for(const x of [-1.2,1.2])for(const z of [-1.2,1.2]){const post=new THREE.Mesh(new THREE.BoxGeometry(.1,2.6,.1));post.position.set(x,1.3,z);canopy.add(post);}
    const roof=new THREE.Mesh(new THREE.BoxGeometry(2.7,.1,2.7));roof.position.y=2.65;canopy.add(roof);
    const obstacles=measuredSceneryColliders(canopy,'canopy',level),placed={...level,obstacles};
    expect(obstacles).toHaveLength(4);expect(dryStandingGround(placed,{x:0,y:0,z:0})).not.toBeNull();expect(dryStandingGround(placed,{x:1.2,y:0,z:1.2})).toBeNull();
    expect(obstacles.every(o=>o.footprint&&o.maxX-o.minX<.11&&o.maxZ-o.minZ<.11)).toBe(true);
  });
  it('uses the same metre scale and rotation for visual roots and collision',()=>{
    const library:RepairPropLibrary={create:()=>{const g=new THREE.Group();g.add(new THREE.Mesh(new THREE.BoxGeometry(2,1,.2)));return g;},release:()=>{},dispose:()=>{}};
    const{root}=createSceneryInstance(library,{id:'fence',siteId:'pier_hoist',kind:'fence',position:{x:5,y:0,z:4},yaw:Math.PI/2,requires:[]});
    const bounds=new THREE.Box3().setFromObject(root),obstacles=measuredSceneryColliders(root,'fence',level);
    expect(bounds.min.y).toBeCloseTo(0);expect(obstacles[0]!.minX).toBeCloseTo(bounds.min.x);expect(obstacles[0]!.maxZ).toBeCloseTo(bounds.max.z);
    expect(obstacles[0]!.maxX-obstacles[0]!.minX).toBeCloseTo(.2);expect(obstacles[0]!.maxZ-obstacles[0]!.minZ).toBeCloseTo(2);
  });
  it('removes cleanup stock and its collider together only after actual restoration',()=>{
    const placement={requires:[],untilRestored:'creek_bridge'},obstacle={id:'visible-fallen-log',minX:-.5,maxX:.5,minZ:-.5,maxZ:.5,blockedUntil:['creek_bridge']},placed={...level,obstacles:[obstacle]},p={x:0,y:0,z:0};
    expect(sceneryVisible(placement,new Set())).toBe(true);expect(collidingObstacles(placed,p,p,new Set())).toHaveLength(1);
    const restored=new Set(['creek_bridge']);expect(sceneryVisible(placement,restored)).toBe(false);expect(collidingObstacles(placed,p,p,restored)).toHaveLength(0);
  });
});
