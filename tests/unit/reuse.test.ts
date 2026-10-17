import{afterAll,beforeAll,describe,expect,it}from'vitest';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';import*as THREE from'three';
import{RestorerRig,RESTORER_SHA256}from'../../src/render/hero-rig';
import{WINDMILL_SHA256}from'../../src/render/windmill-asset';
import{ISLAND_LEVEL}from'../../src/content/island-level';import{SITE_PLAN}from'../../src/content/site-plan';import{collidingObstacles,sampleGround}from'../../src/domain/terrain';
import{withPlantedTrees}from'../../src/content/nature-layout';
import{createIslandNature,type IslandNature}from'../../src/render/environment/island-nature';
import{createPBRFamily,createIslandSurfaceMaterials}from'../../src/render/environment/surface-materials';
const all=new Set(ISLAND_LEVEL.triangles.flatMap(t=>t.requires??[])); // Geometry-only diagnostics.
describe('licensed-reuse integration without approval shortcuts',()=>{
  let nature:IslandNature;
  beforeAll(async()=>{nature=await createIslandNature(ISLAND_LEVEL);});
  afterAll(()=>nature.dispose());
  it('retains exact main-gated GLB bytes',()=>{
    const digest=(name:string)=>createHash('sha256').update(readFileSync(new URL(`../../assets/${name}`,import.meta.url))).digest('hex');
    expect(digest('hero/restorer.glb')).toBe(RESTORER_SHA256);expect(digest('windmill/headland-windmill.glb')).toBe(WINDMILL_SHA256);
  });
  it('encodes upward tangent height normals with positive decoded Z in every family',()=>{
    for(const family of ['ground','wood','timber','stone','water','leaf']as const){const maps=createPBRFamily(family,'#ffffff'),normal=maps.material.normalMap as THREE.DataTexture,data=normal.image.data!;
      for(let i=2;i<data.length;i+=4)expect(data[i],`${family} blue channel`).toBeGreaterThanOrEqual(128);
      maps.dispose();}
  });
  it('keeps construction board maps distinct and restrained relative to tree bark',()=>{
    const surfaces=createIslandSurfaceMaterials(),bark=createPBRFamily('wood','#876341');
    expect(surfaces.wood.name).toBe('island-nature-timber');expect(surfaces.wood.normalScale.x).toBeLessThan(.2);
    expect((surfaces.wood.normalMap as THREE.DataTexture).image.data).not.toEqual((bark.material.normalMap as THREE.DataTexture).image.data);
    surfaces.dispose();bark.dispose();
  });
  it('samples all eight authored machine contacts from the renamed shared grid',()=>{
    for(const site of SITE_PLAN){const ground=sampleGround(ISLAND_LEVEL,site.position.x,site.position.z,all);expect(ground,site.id).not.toBeNull();expect(ground!.y,site.id).toBeCloseTo(site.position.y,5);}
  });
  it('grounds every provisional anchor',()=>{
    expect(ISLAND_LEVEL.trees.length).toBeGreaterThan(50);
    for(const tree of ISLAND_LEVEL.trees)expect(sampleGround(ISLAND_LEVEL,tree.x,tree.z,all)!.y).toBeCloseTo(tree.y,6);
    expect(ISLAND_LEVEL.obstacles.filter(o=>o.id.startsWith('tree-'))).toHaveLength(ISLAND_LEVEL.trees.length);
  });
  it('uses only planted visible trunks as fixed world colliders',()=>{
    const level=withPlantedTrees(ISLAND_LEVEL,nature.plantedTrees),colliders=level.obstacles.filter(o=>o.id.startsWith('tree-'));
    expect(colliders).toHaveLength(nature.plantedTrees.length);expect(level.trees).toHaveLength(nature.plantedTrees.length);
    expect(colliders.length).toBeLessThan(ISLAND_LEVEL.trees.length);
    expect(level.obstacles.filter(o=>!o.id.startsWith('tree-'))).toEqual(ISLAND_LEVEL.obstacles.filter(o=>!o.id.startsWith('tree-')));
    const matrix=new THREE.Matrix4(),positions:{x:number;y:number;z:number}[]=[];
    nature.group.traverse(object=>{if(object instanceof THREE.InstancedMesh&&object.userData.natureKind==='trunk')for(let i=0;i<object.count;i++){object.getMatrixAt(i,matrix);const position=new THREE.Vector3().setFromMatrixPosition(matrix);positions.push(position);}});
    expect(positions).toHaveLength(colliders.length);
    for(const tree of nature.plantedTrees){
      expect(positions.some(p=>Math.hypot(p.x-tree.position.x,p.y-tree.position.y,p.z-tree.position.z)<1e-5)).toBe(true);
      const obstacle=colliders.find(o=>Math.abs((o.minX+o.maxX)/2-tree.position.x)<1e-6&&Math.abs((o.minZ+o.maxZ)/2-tree.position.z)<1e-6)!;
      expect(obstacle.requires).toEqual(tree.requires);
      expect(collidingObstacles(level,tree.position,tree.position,all).map(o=>o.id)).toContain(obstacle.id);
      if(tree.requires.length)expect(collidingObstacles(level,tree.position,tree.position,new Set()).map(o=>o.id)).not.toContain(obstacle.id);
    }
  });
  it('never reveals locked nature from a fraction without actual restored IDs',()=>{
    nature.update(5,1);const initiallyVisible=nature.group.children.filter(o=>o.visible).length;
    nature.update(6,1,new Set(['not-a-site']));expect(nature.group.children.filter(o=>o.visible)).toHaveLength(initiallyVisible);
    nature.update(7,1,all);expect(nature.group.children.filter(o=>o.visible).length).toBeGreaterThan(initiallyVisible);
    nature.update(8,0);expect(nature.group.children.filter(o=>o.visible)).toHaveLength(initiallyVisible);
  });
  it('keeps a physical creek and real prerequisite cuts despite wider land',()=>{
    expect(sampleGround(ISLAND_LEVEL,0,-8,all)).toBeNull();expect(sampleGround(ISLAND_LEVEL,0,-2)).toBeNull();
    expect(sampleGround(ISLAND_LEVEL,0,-2,new Set(['creek_bridge']))).not.toBeNull();
    expect(sampleGround(ISLAND_LEVEL,-7,1.6)).toBeNull();expect(sampleGround(ISLAND_LEVEL,14,-29.6)).toBeNull();expect(sampleGround(ISLAND_LEVEL,9.5,-41)).toBeNull();
  });
  it('composes gait with recorded bind quaternions on independent worker skeletons',()=>{
    const source=new THREE.Group(),data=JSON.parse(readFileSync(new URL('../../assets/hero/source/bone-bind.json',import.meta.url),'utf8')) as {joints:{name:string;parent:string;local_translation:number[];local_rotation_xyzw:number[]}[]};
    const bones=new Map<string,THREE.Bone>();for(const joint of data.joints){const bone=new THREE.Bone();bone.name=joint.name;bone.position.fromArray(joint.local_translation);bone.quaternion.fromArray(joint.local_rotation_xyzw);bones.set(joint.name,bone);}
    for(const joint of data.joints)(bones.get(joint.parent)??source).add(bones.get(joint.name)!);
    const bind=bones.get('upper_leg.L')!.quaternion.toArray();
    const first=new RestorerRig(source),worker=new RestorerRig(source);first.update({phase:Math.PI/2,speed:2.6,work:false,paused:false,seconds:1},.1);
    const poseA=first.diagnostics();first.update({phase:Math.PI*1.5,speed:2.6,work:false,paused:false,seconds:2},.1);const poseB=first.diagnostics();
    expect(poseA.leftLeg).not.toEqual(poseB.leftLeg);expect(poseA.rightLeg).not.toEqual(poseB.rightLeg);expect(worker.diagnostics().stride).toBe(0);
    worker.update({phase:0,speed:0,work:true,paused:false,seconds:1},.1);expect(worker.diagnostics().work).toBeGreaterThan(0);
    const frozen=worker.diagnostics();worker.update({phase:0,speed:0,work:true,paused:true,seconds:1},.1);expect(worker.diagnostics()).toEqual(frozen);
    expect(source.getObjectByName('upper_leg.L')!.quaternion.toArray()).toEqual(bind);
  });
});
