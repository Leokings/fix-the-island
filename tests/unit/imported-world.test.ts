import{describe,it,expect}from'vitest';import{readFileSync}from'node:fs';import*as THREE from'three';import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';
import{buildImportedWorld}from'../../src/render/imported-world';import{AnimatedHero}from'../../src/render/animated-hero';
import{dryStandingGround,hitsObstacle,sampleGround,type LevelData}from'../../src/domain/terrain';import{World}from'../../src/domain/world';import{REPAIR_SCENARIOS}from'../../src/genlayer';
function actualIsland(){
  const bytes=readFileSync(new URL('../../assets/island/google-island.glb',import.meta.url)),length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length).toString()),binary=20+length+8;
  const read=(id:number)=>{const a=json.accessors[id],v=json.bufferViews[a.bufferView],count=a.type==='VEC3'?3:1,width=a.componentType===5126?4:2;return Array.from({length:a.count*count},(_,i)=>{const offset=binary+(v.byteOffset??0)+(a.byteOffset??0)+Math.floor(i/count)*(v.byteStride??count*width)+(i%count)*width;return width===4?bytes.readFloatLE(offset):bytes.readUInt16LE(offset);});};
  const primitive=json.meshes[0].primitives[0],geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(read(primitive.attributes.POSITION),3));geometry.setIndex(read(primitive.indices));const group=new THREE.Group();group.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial()));group.scale.set(.7,.28,.7);group.position.set(9.723,0,-1.003);return buildImportedWorld(group);
}
const imported=actualIsland();
describe('whole imported island, no invisible repair-bound floors',()=>{
  it('extracts the actual connected sand AND raised green interior',()=>{
    expect(imported.level.triangles).toHaveLength(271);expect(imported.stats.components).toBe(236);expect(sampleGround(imported.level,0,0)!.y).toBeGreaterThan(3);expect(imported.level.spawn.y).toBeLessThan(2);
    expect(imported.level.triangles.every(t=>!t.requires?.length)).toBe(true);expect(imported.level.gates).toBeUndefined();expect(dryStandingGround(imported.level,imported.level.spawn)).not.toBeNull();
  });
  it('relocates all eight catalog sites onto the same visible floor',()=>{
    const world=new World(imported.level,REPAIR_SCENARIOS);for(const site of world.snapshot().sites){expect(site.position).toEqual(imported.level.sitePositions![site.id]);expect(dryStandingGround(imported.level,site.position),site.id).not.toBeNull();}expect(world.snapshot().restoredSiteIds).toEqual([]);
  });
  it('tests obstacle height at sampled standing ground, not caller Y=0',()=>{
    const level:LevelData={id:'raised',spawn:{x:0,y:3,z:0},trees:[],visibleSiteIds:[],bounds:{minX:-5,maxX:5,minZ:-5,maxZ:5},triangles:[{id:'ground',a:{x:-5,y:3,z:-5},b:{x:0,y:3,z:5},c:{x:5,y:3,z:-5},biome:'test'}],obstacles:[{id:'visible-rock',minX:-.2,maxX:.2,minZ:-.2,maxZ:.2,minY:3,maxY:4}]};
    expect(dryStandingGround(level,{x:0,y:0,z:0})).toBeNull();
  });
  it('collides with visible polygon footprints, not empty bounding-box corners',()=>{
    const obstacle={id:'rock',minX:0,maxX:2,minZ:0,maxZ:2,footprint:[{x:0,z:0},{x:2,z:0},{x:0,z:2}]};expect(hitsObstacle({x:.1,y:0,z:.1},{x:.1,y:0,z:.1},obstacle)).toBe(true);expect(hitsObstacle({x:1.8,y:0,z:1.8},{x:1.8,y:0,z:1.8},obstacle)).toBe(false);expect(hitsObstacle({x:-1,y:0,z:.4},{x:2,y:0,z:.4},obstacle)).toBe(true);
  });
  it('migrates validated old drafts but never reuses obsolete coordinates',()=>{
    const world=new World(imported.level,REPAIR_SCENARIOS),save=world.exportSave();world.restoreSave({...save,levelId:'island-stage-b-v1',position:{x:-38,y:2,z:44}});expect(world.snapshot().player.position).toEqual(imported.level.spawn);expect(world.exportSave().levelId).toBe(imported.level.id);expect(world.exportSave().sites.map(s=>s.draft)).toEqual(save.sites.map(s=>s.draft));expect(world.snapshot().restoredSiteIds).toEqual([]);expect(()=>world.restoreSave({...save,levelId:'unknown-layout'})).toThrow();
  });
  it('plays the actual robot walking/running clips independently and freezes on pause',async()=>{
    const bytes=readFileSync(new URL('../../assets/robot/RobotExpressive.glb',import.meta.url)),source=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');const robot=new AnimatedHero(source),worker=new AnimatedHero(source);
    const pose={phase:0,speed:2.6,work:false,paused:false,seconds:0};robot.update(pose,.1);expect(robot.diagnostics().animation).toBe('Walking');const before=JSON.stringify(robot.diagnostics());robot.update({...pose,paused:true},.1);expect(JSON.stringify(robot.diagnostics())).toBe(before);robot.update({...pose,speed:3.6},.1);expect(robot.diagnostics().animation).toBe('Running');expect(worker.diagnostics().animation).toBe('Idle');expect(robot.diagnostics().height).toBe(1.65);robot.dispose();worker.dispose();
  });
});
