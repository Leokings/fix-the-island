import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { ColorCorrectionShader } from 'three/addons/shaders/ColorCorrectionShader.js';
import { getRepairScenario } from '../genlayer';
import type { RepairArtifact, SiteFixture } from '../genlayer';
import { socketPosition, portPosition } from '../content/assembly-layout';
import { BEACON_SPIRE,SERVICE_BOARD,SHELTER,SHELTER_POST,SLUICE_WALK,TEMPORARY_TOWER,shelterPosition } from '../content/service-layout';
import { sampleGround,type LevelData } from '../domain/terrain';
import { SITE_PLAN } from '../content/site-plan';
import type { SiteSnapshot, WorldSnapshot } from '../domain/world';
import type { RendererContract, RenderFrame, RenderStyle, HitAnchor,RepairRenderLayout,CouncilShot,CouncilStage } from './contract';
import {CouncilCircle} from './island/council-circle';
import {SiteCouncils} from './island/site-councils';
import {WindmillPads,WINDMILL_PADS} from './island/windmill-pads';
import {NightLights} from './island/night-lights';
import { INSPECT_CAMERA, WALK_CAMERA, WARM_STYLE } from './presets';
import { repairRegions } from './layout';
import { projectedHit } from './hit-test';
import { loadAnimatedHero,AnimatedHero } from './animated-hero';
import { loadWindmill,WINDMILL_SHA256 } from './windmill-asset';
import { createIslandSurfaceMaterials,type IslandNature,type IslandSurfaceMaterials } from './environment/island-nature';
import { groundValueColor,lightingProfile,withDaylight } from './lighting-rig';
import type { RepairDressing } from '../content/repair-dressing';
import {REPAIR_PROP_SOURCES,type RepairPropLibrary} from './environment/repair-props';
import {createSceneryInstance,sceneryVisible} from './environment/scenery-instance';
import { restorationPresentation,repairStateAppearance } from './restoration-feedback';
import { describeRepair } from '../ui/repair-learning';
import { inferPumpDesign } from '../ui/build-view';
import {createIslandCutaway,type ProtectedView} from './island-cutaway';
import {buildCrewScaffold} from './island/scaffold';
import {animatePipeFlow,portMaterial,pumpPipe} from './island/pump-machinery';
import {animateSitePart,buildSitePart,buildSitePlatform,ghostSitePart,hasAuthoredMachine,pulseGhosts,setPartHandle} from './island/site-machinery';

interface Assembly {root:THREE.Group;parts:THREE.Group;connections:THREE.Group;markers:THREE.Group;scaffold:THREE.Group;effect:THREE.Mesh;status:THREE.Mesh<THREE.RingGeometry,THREE.MeshStandardMaterial>;sparks:THREE.Group;cargo:THREE.Group|null;cargoRope:THREE.Mesh|null;flowMaterial:THREE.MeshStandardMaterial;stamp:string;fixture:SiteFixture}
// Inspection physically opens the temporary service cover. The artifact's
// guard/connection still exists; closing inspection closes this same cover.
const servicePoint=(siteId:string,slot:string,point:{x:number;y:number;z:number},open:boolean,artifact?:RepairArtifact)=>({...point,x:point.x+(siteId==='coast_windmill'&&slot==='guard'&&open?-0.95:0)+(siteId==='pier_hoist'&&artifact?.parts.find(part=>part.slotId===slot)?.settingId==='rail_1500'?(slot==='weight_a'?-.45:slot==='weight_b'?.45:0):0)});
const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
export class ThreeRenderer implements RendererContract {
  private readonly scene=new THREE.Scene();
  private readonly camera=new THREE.OrthographicCamera(-8,8,4.2,-4.2,0.1,280);
  private readonly inspectionCamera=new THREE.OrthographicCamera(-3,3,3,-3,0.1,280);
  private readonly key=new THREE.DirectionalLight();private readonly fill=new THREE.HemisphereLight();
  private readonly bounce=new THREE.DirectionalLight('#e2ccaa',.45);
  private readonly player=new THREE.Group();private readonly target=new THREE.Vector3();private readonly raycaster=new THREE.Raycaster();
  private readonly materials=new Map<string,THREE.MeshStandardMaterial>();private readonly assemblies=new Map<string,Assembly>();
  private readonly structures=new Map<string,THREE.Group>();private readonly terrainPatches:{mesh:THREE.Mesh;requires:readonly string[];id:string}[]=[];
  private readonly gates=new Map<string,{root:THREE.Group;requires:readonly string[]}>();
  private readonly textures:THREE.Texture[]=[];private readonly foliageBounds:{box:THREE.Box3;requires:readonly string[]}[]=[];
  private style=WARM_STYLE;private width=1;private height=1;private host!:HTMLElement;private renderer!:THREE.WebGLRenderer;
  private composer!:EffectComposer;private ao!:SSAOPass;private frames=0;private snapshot:WorldSnapshot|null=null;
  private grade!:ShaderPass;private bloom!:UnrealBloomPass;private lightingHeight=2;
  private appliedLightingHeight=-Infinity;private appliedLightingStyle:RenderStyle|null=null;
  // Night to dawn: 0 at night, 1 by morning; eases toward restored/8 so each repair visibly lightens the sky.
  private daylight=0;private appliedDaylight=-1;
  private surfaces:IslandSurfaceMaterials|null=null;
  private layout:RepairRenderLayout|null=null;
  private heroRig:AnimatedHero|null=null;private windmill:THREE.Group|null=null;
  private readonly workerRigs=new Map<string,AnimatedHero[]>();private disposed=false;
  private readonly dressingRoots:{root:THREE.Group;requires:readonly string[];untilRestored?:string}[]=[];
  private readonly importedHero=new THREE.Vector3();private readonly importedEye=new THREE.Vector3();
  private cutaway:ReturnType<typeof createIslandCutaway>|null=null;
  private readonly cableMaterial=new THREE.MeshStandardMaterial({color:'#2e2a26',roughness:.7,flatShading:true});
  private readonly ropeMaterial=new THREE.MeshStandardMaterial({color:'#b48c55',roughness:.95,flatShading:true});
  private council:CouncilCircle|null=null;private siteCouncils:SiteCouncils|null=null;private windmillPads:WindmillPads|null=null;private restoredSeen=-1;private nightLights:NightLights|null=null;
  // Unlit near-white environment materials (foam, ripples, creek edges) dim with the night; base colours kept here.
  private readonly nightDimmed:{material:THREE.MeshBasicMaterial;base:THREE.Color}[]=[];private dimmedAt=-1;
  // While building at night, a work light over the machine keeps parts readable.
  private readonly workLight=new THREE.SpotLight(0xffe2b0,0,16,Math.PI/5,.55,1.2);private councilShot:CouncilShot=null;private spanNow=0;
  // Explicit development-only renderer isolation. Never game state or a
  // production setting; gate captures use no probe query parameter.
  /** Dev only: ?daylight=0..1 pins the time of day for captures. */
  private readonly devDaylight=import.meta.env.DEV&&new URLSearchParams(location.search).has('daylight')?Number(new URLSearchParams(location.search).get('daylight')):null;
  private readonly lightingProbe=import.meta.env.DEV?new URLSearchParams(location.search).get('render-probe'):null;
  // Development-only visual QA: frame the camera on a point. Moves no player and grants nothing.
  // Development-only: preview environment recovery for listed sites (scenery only, never game state).
  private readonly devRestored=import.meta.env.DEV?new URLSearchParams(location.search).get('preview-restored')?.split(',').filter(Boolean)??[]:[];
  // Development-only display of a finished pump design; never game state.
  private readonly devPump=import.meta.env.DEV?new URLSearchParams(location.search).get('preview-pump'):null;
  private readonly devCameraAt=import.meta.env.DEV?new URLSearchParams(location.search).get('camera-at')?.split(',').map(Number)??null:null;

  constructor(private readonly nature:IslandNature|null=null,private readonly repairProps:RepairPropLibrary|null=null,private readonly dressing:readonly RepairDressing[]=[],private readonly importedEnvironment:THREE.Group|null=null){}

  initialize(host:HTMLElement,level:LevelData):void {
    this.host=host;this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.info.autoReset=false;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.renderer.domElement.setAttribute('aria-label','Fix the Island live 3D world');host.append(this.renderer.domElement);
    this.key.castShadow=true;this.key.shadow.mapSize.set(2048,2048);
    Object.assign(this.key.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:0.5,far:130});this.key.shadow.normalBias=0.018;this.key.shadow.bias=-.00008;this.key.shadow.radius=2;
    if(this.lightingProbe==='shadows-off')this.renderer.shadowMap.enabled=false;
    if(this.lightingProbe==='bias-high'){this.key.shadow.normalBias=.05;this.key.shadow.bias=.00005;}
    this.scene.add(this.key,this.key.target,this.fill,this.bounce,this.bounce.target);
    const rough=new Uint8Array(32*32*4),normal=new Uint8Array(32*32*4);
    for(let i=0;i<32*32;i++) {
      const noise=Math.sin(i*12.9898)*43758.5453%1,val=200+Math.floor(Math.abs(noise)*50);
      rough.set([val,val,val,255],i*4);normal.set([128+Math.round(noise*10),128+Math.round(noise*8),252,255],i*4);
    }
    const roughnessMap=new THREE.DataTexture(rough,32,32),normalMap=new THREE.DataTexture(normal,32,32);
    for(const texture of [roughnessMap,normalMap]){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(8,8);texture.needsUpdate=true;this.textures.push(texture);}
    this.surfaces=createIslandSurfaceMaterials();
    this.surfaces.ground.vertexColors=true;this.surfaces.ground.color.set('#ffffff');this.surfaces.ground.normalScale.set(.10,.10);
    this.surfaces.stone.color.set('#d2cab4');this.surfaces.stone.normalScale.set(.08,.08);
    for(const id of ['ground','wood','stone','water']as const)this.materials.set(id,this.surfaces[id]);
    for(const id of ['metal','foliage','amber','socket','wire','pipe','joint','glow','hero']) {
      const material=new THREE.MeshStandardMaterial({roughnessMap,normalMap,normalScale:new THREE.Vector2(0.2,0.2),metalness:id==='metal'?0.35:0});
      material.color.set(({stone:'#838d8f',amber:'#dda254',socket:'#e1c57b',wire:'#b37b4a',pipe:'#5eaeb0',joint:'#777d83',glow:'#d2efb2',hero:'#316b76'} as Record<string,string>)[id]??'#999999');
      if(id==='glow'){material.emissive.set('#b1dfa3');material.emissiveIntensity=0.9;material.transparent=true;material.opacity=0.35;material.depthWrite=false;}
      this.materials.set(id,material);
    }
    if(this.importedEnvironment){
      this.scene.add(this.importedEnvironment);host.dataset.environment=String(this.importedEnvironment.userData.environment??'imported-google-island');
      // Water/backdrop stays outside the cutaway scope so it is never clipped or mistaken for floor.
      this.cutaway=createIslandCutaway((this.importedEnvironment.getObjectByName('island-cutaway-scope') as THREE.Group|undefined)??this.importedEnvironment,level);
    }
    const groups=new Map<string,typeof level.triangles[number][]>();
    for(const t of level.triangles){const key=JSON.stringify(t.requires??[]);if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(t);}
    for(const [key,triangles]of this.importedEnvironment?[]:groups) {
      const positions:number[]=[],uvs:number[]=[],colors:number[]=[];
      for(const triangle of triangles)for(const vertex of [triangle.a,triangle.b,triangle.c]){positions.push(vertex.x,vertex.y,vertex.z);uvs.push(vertex.x,vertex.z);const color=groundValueColor(vertex.x,vertex.y,vertex.z);colors.push(color.r,color.g,color.b);}
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
      const mesh=this.addMesh(geometry,'ground');mesh.userData.category='ground';this.terrainPatches.push({mesh,requires:JSON.parse(key) as string[],id:triangles[0]!.id});
    }
    // Extruded greybox banks make the narrow walk surfaces visibly bounded.
    if(level.banks&&!this.importedEnvironment) {
      const points:number[]=[],uvs:number[]=[];
      for(const [a,b] of level.banks) {
        const bottom=Math.max(0,Math.min(a.y,b.y)-2.2);
        const length=Math.hypot(b.x-a.x,b.z-a.z);
        for(const [q,u]of [[v(a.x,a.y-0.02,a.z),0],[v(a.x,bottom,a.z),0],[v(b.x,b.y-0.02,b.z),length],[v(b.x,b.y-0.02,b.z),length],[v(a.x,bottom,a.z),0],[v(b.x,bottom,b.z),length]] as const){points.push(q.x,q.y,q.z);uvs.push(u,q.y-bottom);}
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();
      const mesh=this.addMesh(geometry,'stone');mesh.material=this.materials.get('stone')!.clone();(mesh.material as THREE.Material).side=THREE.DoubleSide;mesh.userData.category='banks';
    }
    if(!this.importedEnvironment?.userData.ownsWater){
      const seaGeometry=new THREE.PlaneGeometry(192,192),seaUV=seaGeometry.getAttribute('uv');
      for(let i=0;i<seaUV.count;i++)seaUV.setXY(i,seaUV.getX(i)*192,seaUV.getY(i)*192);
      const sea=this.addMesh(seaGeometry,'water');sea.rotation.x=-Math.PI/2;sea.userData.category='water';sea.receiveShadow=true;
    }
    // The same imported robot and authored clips are used by player and crews.
    this.player.userData.category='hero';this.scene.add(this.player);
    this.host.dataset.heroReady='loading';
    void loadAnimatedHero().then(source=>{
      if(this.disposed)return;this.heroRig=new AnimatedHero(source);this.player.add(this.heroRig.root);
      if(this.lightingProbe==='albedo')this.heroRig.root.traverse(object=>{
        if(!(object instanceof THREE.Mesh))return;
        const materials=Array.isArray(object.material)?object.material:[object.material];
        const unlit=materials.map(material=>{const original=material as THREE.MeshStandardMaterial;const result=new THREE.MeshBasicMaterial({map:original.map,color:original.color,side:original.side});material.dispose();return result;});
        object.material=Array.isArray(object.material)?unlit:unlit[0]!;
      });
      for(const [id,assembly]of this.assemblies){
        const rigs=[new AnimatedHero(source,'#d6b47e'),new AnimatedHero(source,'#779aa6')];
        rigs.forEach((rig,i)=>{
          const x=i===0?-2.4:2.4,z=1.6,ground=sampleGround(level,assembly.root.position.x+x,assembly.root.position.z+z,new Set(level.triangles.flatMap(t=>t.requires??[])));
          rig.root.position.set(x,(ground?.y??assembly.root.position.y)-assembly.root.position.y,z);rig.root.rotation.y=i===0?Math.PI/3:-Math.PI/3;
          // At the pump one crew member works up on the scaffold deck behind the machine.
          if(id==='village_pump'&&i===0){rig.root.position.set(-0.9,1.2,-1.15);rig.root.rotation.y=0.25;}
          const hammer=this.repairProps?.create('tool-hammer')??new THREE.Group();
          hammer.traverse(object=>{if(object instanceof THREE.Mesh)object.castShadow=object.receiveShadow=true;});
          hammer.rotation.x=Math.PI/2;rig.attachTool(hammer);assembly.scaffold.add(rig.root);
        });this.workerRigs.set(id,rigs);
      }
      if(level.id.startsWith('stylized-island')){this.council=new CouncilCircle();this.windmillPads=new WindmillPads();this.nightLights=new NightLights();this.scene.add(this.nightLights.group,this.workLight,this.workLight.target);
        this.importedEnvironment?.traverse(object=>{const m=(object as THREE.Mesh).material;for(const material of Array.isArray(m)?m:m?[m]:[])if(material instanceof THREE.MeshBasicMaterial&&!material.map&&material.color.r+material.color.g+material.color.b>2.4)this.nightDimmed.push({material,base:material.color.clone()});});this.siteCouncils=new SiteCouncils(source,level.visibleSiteIds,level.obstacles,[...Object.values(WINDMILL_PADS),...this.dressing.map(item=>({x:item.position.x,z:item.position.z}))]);this.scene.add(this.council.group,this.siteCouncils.group,this.windmillPads.group);if(import.meta.env.DEV)Object.assign(window,{__councilSpots:Object.fromEntries([...this.siteCouncils.councils].map(([id,c])=>[id,c.spots.map((s,i)=>({...s,y:c.actors[i]!.root.position.y}))]))});this.host.dataset.councilReady='true';}
      this.host.dataset.heroReady='true';
    }).catch(error=>{this.host.dataset.heroReady='error';console.error('Animated robot load failed',error);});
    for(const siteId of level.visibleSiteIds) {
      const fixture=getRepairScenario(siteId),root=new THREE.Group();root.userData.entityId=siteId;root.userData.category='assembly';
      const planned=SITE_PLAN.find(site=>site.id===siteId);if(!planned)continue;
      // Underlying geometry is read only for asset contact, never restoration
      // authority. A renamed grid ID cannot send every upland prop to Y=2.
      const underlying=new Set(level.triangles.flatMap(t=>t.requires??[]));
      const at=level.sitePositions?.[siteId]??planned.position;
      const ground=sampleGround(level,at.x,at.z,underlying);
      if(!ground)throw new Error(`Missing shared site floor: ${siteId}`);
      const site={...at,y:level.sitePositions?.[siteId]?.y??ground.y};
      root.position.set(site.x,site.y,site.z);
      const parts=new THREE.Group(),connections=new THREE.Group(),markers=new THREE.Group(),scaffold=new THREE.Group();root.add(parts,connections,markers,scaffold);
      const platform=buildSitePlatform(siteId);
      if(platform)root.add(platform);
      else if(siteId!=='creek_bridge'&&siteId!=='coast_windmill'){const board=this.addMesh(new THREE.BoxGeometry(SERVICE_BOARD.width,SERVICE_BOARD.height,SERVICE_BOARD.depth),'wood',root);board.position.y=SERVICE_BOARD.y;}
      const effect=this.addMesh(new THREE.CylinderGeometry(2.3,2.3,0.035,32),'glow',root);effect.position.y=0.04;effect.visible=false;
      const status=new THREE.Mesh(new THREE.RingGeometry(2.03,2.13,48),new THREE.MeshStandardMaterial({color:'#bb7659',roughness:1,side:THREE.DoubleSide}));
      status.rotation.x=-Math.PI/2;status.position.y=.09;status.receiveShadow=true;root.add(status);
      const sparks=new THREE.Group();sparks.visible=false;root.add(sparks);
      const sparkGeometry=new THREE.SphereGeometry(.035,4,3);
      for(let i=0;i<18;i++)this.addMesh(sparkGeometry,'glow',sparks);
      let cargo:THREE.Group|null=null,cargoRope:THREE.Mesh|null=null;
      if(siteId==='pier_hoist'&&this.repairProps){
        cargo=new THREE.Group();cargo.name='landing-cargo';root.add(cargo);
        for(let i=0;i<3;i++){
          const prop=this.repairProps.create('resource-planks'),bounds=new THREE.Box3().setFromObject(prop),centre=bounds.getCenter(v(0,0,0));
          prop.position.set(-centre.x,-bounds.min.y,-centre.z);const bundle=new THREE.Group();bundle.add(prop);bundle.rotation.y=Math.PI/2;cargo.add(bundle);
          prop.traverse(object=>{if(object instanceof THREE.Mesh)object.castShadow=object.receiveShadow=true;});
        }
        cargoRope=this.addMesh(new THREE.CylinderGeometry(.022,.022,1,6),'wood',root);cargoRope.visible=false;
      }
      if(siteId==='village_pump')scaffold.add(buildCrewScaffold());
      else{
      for(const x of [-2.2,2.2]) {
        const post=this.addMesh(new THREE.CylinderGeometry(0.055,0.055,2.4,6),'metal',scaffold);post.position.set(x,1.2,0.9);
      }
      const rail=this.addMesh(new THREE.BoxGeometry(4.5,0.08,0.1),'metal',scaffold);rail.position.set(0,2.2,0.9);
      }
      scaffold.visible=false;
      const flowMaterial=this.materials.get('pipe')!.clone();if(siteId==='village_pump'){flowMaterial.color.set('#b9763f');flowMaterial.roughness=.5;flowMaterial.metalness=.3;}
      this.assemblies.set(siteId,{root,parts,connections,markers,scaffold,effect,status,sparks,cargo,cargoRope,flowMaterial,stamp:'',fixture});this.scene.add(root);
      if(!this.importedEnvironment||siteId==='coast_windmill')this.addStructure(siteId,root.position);
    }
    if(this.nature){
      this.scene.add(this.nature.group);
      const tuned=new Set<THREE.Material>();
      this.nature.group.traverse(object=>{if(!(object instanceof THREE.Mesh))return;for(const material of Array.isArray(object.material)?object.material:[object.material]){if(!(material instanceof THREE.MeshStandardMaterial)||tuned.has(material))continue;tuned.add(material);material.normalScale.set(.12,.12);if(material.name.includes('stone'))material.color.set('#d2cab4');}});
      for(const tree of this.nature.plantedTrees){const {x,y,z}=tree.position;this.foliageBounds.push({box:new THREE.Box3(v(x-1.35,y,z-1.35),v(x+1.35,y+4.8,z+1.35)),requires:tree.requires});}
      this.host.dataset.natureReady='true';this.host.dataset.plantedTreeColliders=String(level.obstacles.filter(o=>o.id.startsWith('tree-')).length);
    }
    for(const gate of level.gates??[]) {
      const root=new THREE.Group();root.position.set(gate.position.x,gate.position.y,gate.position.z);root.userData.category=gate.kind==='flood'?'water':'lock';
      if(gate.kind==='gap'){const a=this.addMesh(new THREE.BoxGeometry(6,0.08,2.7),'water',root);a.position.y=-1.7;}
      else if(gate.kind==='flood'){const a=this.addMesh(new THREE.BoxGeometry(3.2,0.16,4),'water',root);a.position.y=0.08;}
      else {for(const x of [-1.4,1.4]){const a=this.addMesh(new THREE.BoxGeometry(0.18,2,0.18),'wood',root);a.position.set(x,1,0);}const bar=this.addMesh(new THREE.BoxGeometry(2.8,0.3,0.18),'amber',root);bar.position.y=1.1;}
      this.gates.set(gate.id,{root,requires:gate.requires});this.scene.add(root);
    }
    this.target.set(level.spawn.x,level.spawn.y+WALK_CAMERA.targetHeight,level.spawn.z);
    if(this.repairProps)for(const placement of this.dressing){
      const{root}=createSceneryInstance(this.repairProps,placement);
      root.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=object.receiveShadow=true;for(const material of Array.isArray(object.material)?object.material:[object.material])if(material instanceof THREE.MeshStandardMaterial){material.roughness=.86;material.envMapIntensity=.45;}}});
      if(placement.kind==='workbench'){
        const hammer=this.repairProps.create('tool-hammer');hammer.rotation.z=Math.PI/2;hammer.position.set(.12,.96,.2);root.add(hammer);hammer.traverse(object=>{if(object instanceof THREE.Mesh)object.castShadow=object.receiveShadow=true;});
      }
      root.visible=placement.requires.length===0;this.scene.add(root);this.dressingRoots.push({root,requires:placement.requires,...(placement.untilRestored?{untilRestored:placement.untilRestored}:{})});
    }
    this.host.dataset.repairProps=JSON.stringify({libraryKinds:Object.keys(REPAIR_PROP_SOURCES).length,placed:this.dressing.length,sites:[...new Set(this.dressing.map(p=>p.siteId))],kinds:[...new Set(this.dressing.map(p=>p.kind)),...(this.dressing.some(p=>p.kind==='workbench')?['tool-hammer']:[])]});
    this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.ao=new SSAOPass(this.scene,this.camera,1,1,8);this.ao.kernelRadius=.28;this.ao.minDistance=.002;this.ao.maxDistance=.12;this.composer.addPass(this.ao);
    // SSAO's override normal material cannot see the component cutaway shader.
    // Imported scenes keep real contact/cast shadows without ghost foliage AO.
    if(this.importedEnvironment)this.ao.enabled=false;
    if(this.lightingProbe==='ao-off'||this.lightingProbe==='albedo')this.ao.enabled=false;
    this.bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.045,.16,1.4);this.composer.addPass(this.bloom);
    this.grade=new ShaderPass(ColorCorrectionShader);this.composer.addPass(this.grade);this.composer.addPass(new OutputPass());this.setStyle(this.style);
    const gl=this.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');host.dataset.unmaskedRenderer=debug?String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)):'unavailable';host.dataset.renderer='webgl2';
  }
  private devPumpArtifact():RepairArtifact|null {
    const fixture=getRepairScenario('village_pump'),design=fixture.technical.designs?.find(d=>d.id===this.devPump);if(!design)return null;
    const option=(slot:string)=>fixture.options.find(o=>o.allowedSlots?.includes(slot))!;
    const port=(slot:string,id:string)=>option(slot).ports.find(p=>p.id===id)!;
    return {schemaVersion:'repair-v1',configuration:{mountZoneId:design.mountZoneId,outputModeId:design.outputModeId,routeId:design.routeId},
      parts:design.slotIds.map(slot=>({id:slot,optionId:option(slot).id,slotId:slot,orientationQuarterTurns:0,settingId:option(slot).allowedSettings?.[0]??'fixed'})),
      connections:design.requiredEdges.map(([a,ap,b,bp])=>({channel:port(a!,ap!).channel,from:{partId:a!,portId:ap!},to:{partId:b!,portId:bp!}}))};
  }
  private addMesh(geometry:THREE.BufferGeometry,id:string,parent:THREE.Object3D=this.scene):THREE.Mesh {
    const mesh=new THREE.Mesh(geometry,this.materials.get(id));mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  private addStructure(id:string,position:THREE.Vector3):void {
    const structure=new THREE.Group();structure.position.copy(position);structure.userData.category='structure';structure.name=`placeholder:${id}`;
    if(id==='coast_windmill') {
      this.host.dataset.windmillReady='loading';
      void loadWindmill().then(asset=>{if(this.disposed)return;this.windmill=asset;structure.add(asset);this.host.dataset.windmillReady='true';this.host.dataset.windmillSha=WINDMILL_SHA256;const assembly=this.assemblies.get(id);if(assembly)assembly.stamp='';}).catch(error=>{this.host.dataset.windmillReady='error';console.error('Windmill asset load failed',error);});
    }else if(['pier_hoist','upland_waterworks'].includes(id)) {
      const at=shelterPosition(id);
      const shell=this.addMesh(new THREE.BoxGeometry(SHELTER.width,SHELTER.height,SHELTER.depth),'stone',structure);shell.position.set(at.x,SHELTER.height/2,at.z);
      const roof=this.addMesh(new THREE.ConeGeometry(2.6,1.15,4),'wood',structure);roof.rotation.y=Math.PI/4;roof.scale.z=0.7;roof.position.set(at.x,2.85,at.z);
      for(const x of [-SHELTER_POST.x,SHELTER_POST.x]){const post=this.addMesh(new THREE.BoxGeometry(SHELTER_POST.width,SHELTER.height,SHELTER_POST.depth),'wood',structure);post.position.set(at.x+x,SHELTER.height/2,at.z+SHELTER.depth/2);}
    }else if(id==='creek_bridge') {
      for(const x of [-4.7,4.7]){const shoe=this.addMesh(new THREE.BoxGeometry(0.8,0.3,1.8),'stone',structure);shoe.position.set(x,-0.07,0);}
    }else if(id==='tidal_sluice') {
      const walk=this.addMesh(new THREE.BoxGeometry(SLUICE_WALK.width,SLUICE_WALK.height,SLUICE_WALK.depth),'wood',structure);walk.position.set(SLUICE_WALK.x,SLUICE_WALK.y,SLUICE_WALK.z);
    }else if(id==='ridge_beacon') {
      const spire=this.addMesh(new THREE.CylinderGeometry(0.5,BEACON_SPIRE.width/2,BEACON_SPIRE.height,8),'stone',structure);spire.position.set(BEACON_SPIRE.x,BEACON_SPIRE.height/2,BEACON_SPIRE.z);
    }
    this.structures.set(id,structure);this.scene.add(structure);
  }
  private clear(group:THREE.Group):void {group.traverse((o)=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});group.clear();}
  private partGeometry(kind:string,facts:Readonly<Record<string,number|string>>,slot:string,parent:THREE.Group):void {
    if(kind==='gear') {
      const teeth=Number(facts.teeth)||12,r=0.32+teeth/180,shape=new THREE.Shape();
      for(let i=0;i<teeth*4;i++){const angle=i/(teeth*4)*Math.PI*2,radius=i%4===1||i%4===2?r:r*0.87;const x=Math.cos(angle)*radius,y=Math.sin(angle)*radius;if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);}shape.closePath();
      const mesh=this.addMesh(new THREE.ExtrudeGeometry(shape,{depth:0.12,bevelEnabled:false}),'metal',parent);mesh.position.z=-0.06;
      const hub=this.addMesh(new THREE.CylinderGeometry(0.095,0.095,0.24,8),'joint',parent);hub.rotation.x=Math.PI/2;
    }else if(['valve','relief','pump','filter','splitter','trunk','drain','overflow','outlet'].includes(kind)) {
      const pipe=this.addMesh(new THREE.CylinderGeometry(kind==='pump'?0.32:0.16,kind==='pump'?0.32:0.16,0.55,10),'pipe',parent);pipe.rotation.z=Math.PI/2;
      if(kind==='valve'||kind==='relief'){const handle=this.addMesh(new THREE.TorusGeometry(0.23,0.035,5,14),'amber',parent);handle.position.y=0.23;handle.rotation.x=-Math.PI/2;const stem=this.addMesh(new THREE.CylinderGeometry(0.035,0.035,0.26,6),'metal',parent);stem.position.y=0.13;}
    }else if(['deck','beam','brace','rail','boom','baffle','gate','rack','shoe'].includes(kind)) {
      if(kind==='rail') {
        for(const z of [-1.4,1.4]){const rail=this.addMesh(new THREE.BoxGeometry(10,0.18,0.2),'wood',parent);rail.position.z=z;}
        return;
      }
      const bridge=slot.startsWith('deck_'),brace=kind==='brace';
      const mesh=this.addMesh(new THREE.BoxGeometry(bridge?4.8:kind==='rail'?9:brace?3.8:kind==='boom'?2.5:0.7,brace?0.15:0.18,bridge?2.4:0.4),'wood',parent);
      if(brace)mesh.rotation.z=Math.PI/5;
      if(kind==='rack')for(const x of [-0.25,0.25]){const post=this.addMesh(new THREE.BoxGeometry(0.08,0.6,0.08),'wood',parent);post.position.set(x,0.25,0.18);}
    }else if(kind==='pulley') {
      const wheel=this.addMesh(new THREE.TorusGeometry(0.35,0.08,6,16),'metal',parent);const hub=this.addMesh(new THREE.CylinderGeometry(0.1,0.1,0.2,8),'metal',parent);hub.rotation.x=Math.PI/2;wheel.position.z=0.03;
    }else if(kind==='rope') {const rope=this.addMesh(new THREE.CylinderGeometry(0.04,0.04,1.3,6),'wood',parent);rope.position.y=-0.2;}
    else if(kind==='counterweight'){const mass=Number(facts.mass)||2;this.addMesh(new THREE.BoxGeometry(0.4+mass*0.06,0.36+mass*0.06,0.4),'metal',parent);}
    else if(['guard','shield'].includes(kind)){const shade=this.addMesh(new THREE.CylinderGeometry(0.4,0.52,0.24,10,1,true),'amber',parent);shade.rotation.x=slot==='shield'?0:Math.PI/2;}
    else if(['lens','lamp','reflector'].includes(kind)){const lamp=this.addMesh(new THREE.CylinderGeometry(0.25,0.32,0.2,12),'amber',parent);lamp.rotation.x=Math.PI/2;const rim=this.addMesh(new THREE.TorusGeometry(0.31,0.045,6,12),'metal',parent);rim.position.z=0.13;}
    else if(kind==='cistern'||kind==='pool'){const tank=this.addMesh(new THREE.CylinderGeometry(0.4,0.45,kind==='cistern'?1.2:0.25,12),'pipe',parent);tank.position.y=kind==='cistern'?0.1:0;}
    else if(kind==='shaft'||kind==='coupling'||kind==='crank'){const shaft=this.addMesh(new THREE.CylinderGeometry(0.08,0.08,0.65,8),'metal',parent);shaft.rotation.z=Math.PI/2;if(kind==='crank'){const handle=this.addMesh(new THREE.BoxGeometry(0.08,0.4,0.1),'wood',parent);handle.position.set(0.25,0.15,0);}}
    else {const body=this.addMesh(new THREE.BoxGeometry(kind==='generator'?0.8:0.38,kind==='generator'?0.65:0.42,0.3),'metal',parent);const lid=this.addMesh(new THREE.BoxGeometry(0.26,0.06,0.32),'amber',parent);lid.position.y=0.24;body.userData.placeholder=true;}
  }
  private updateAssembly(site:SiteSnapshot,selected:boolean,snapshot:WorldSnapshot):void {
    const assembly=this.assemblies.get(site.id);if(!assembly||!site.draft)return;
    const appearance=repairStateAppearance(site);assembly.status.material.color.set(appearance.color);assembly.status.material.emissive.set(appearance.color);assembly.status.material.emissiveIntensity=appearance.glow;
    assembly.status.userData.repairState=appearance.label;
    // Drafting is a physical on-site preview. Leaving or pending review shows
    // the damaged machine until the approved construction is installed.
    const devDesign=site.id==='village_pump'&&!selected?this.devPumpArtifact():null;
    const installing=site.phase==='restored'||site.phase==='restoring'||!!devDesign;
    const artifact=devDesign??(installing?site.approvedArtifact??site.draft.artifact:selected?site.draft.artifact:getRepairScenario(site.id).initialArtifact);
    const coverOpen=selected&&snapshot.editor?.stage==='construct'&&site.testSeconds===0;
    const blueprint=selected?this.layout?.blueprint??null:null;
    const stamp=JSON.stringify([artifact,selected?snapshot.editor:null,site.phase,coverOpen,blueprint]);
    if(stamp!==assembly.stamp) {
      this.clear(assembly.parts);this.clear(assembly.connections);this.clear(assembly.markers);assembly.stamp=stamp;
      for(const slot of assembly.fixture.slotIds) {
        const position=servicePoint(site.id,slot,socketPosition(site.id,slot),coverOpen,artifact),part=artifact.parts.find((p)=>p.slotId===slot);
        if(hasAuthoredMachine(site.id)){
          // Blueprint ghosts stand in the chosen approach's empty sockets; the held part's ghost glows.
          const placing=selected&&snapshot.editor?.tab==='parts',held=snapshot.editor?.slotId===slot;
          if(placing&&!part&&blueprint?.includes(slot)){const facts=assembly.fixture.options.find(o=>o.id===(held&&snapshot.editor?.optionId)||o.allowedSlots?.includes(slot))?.facts??{};const ghost=ghostSitePart(site.id,slot,facts,held&&!!snapshot.editor?.optionId);if(ghost){ghost.position.set(position.x,position.y,position.z);ghost.userData.entityId=`socket:${site.id}:${slot}`;assembly.markers.add(ghost);}}
          if(selected&&held&&part&&snapshot.editor?.tab!=='connect'){const ring=this.addMesh(new THREE.TorusGeometry(0.42,0.03,6,28),'amber',assembly.markers);ring.rotation.x=Math.PI/2;ring.position.set(position.x,SERVICE_BOARD.y+SERVICE_BOARD.height/2+0.03,position.z);}
        }else{
        // Until each site has authored ghosts: a ring on empty sockets, a bright ring on the one in hand or selected.
        const held=snapshot.editor?.slotId===slot&&selected;
        const marker=this.addMesh(new THREE.TorusGeometry(held?0.24:0.19,held?0.045:0.035,6,16),held?'amber':'socket',assembly.markers);
        marker.position.set(position.x,position.y,position.z+0.38);marker.userData.entityId=`socket:${site.id}:${slot}`;marker.visible=selected&&snapshot.editor?.tab==='parts'&&(held||!part)&&(!blueprint||blueprint.includes(slot));
        }
        if(!part)continue;
        const option=assembly.fixture.options.find((o)=>o.id===part.optionId)!;const root=new THREE.Group();root.position.set(position.x,position.y,position.z);root.rotation.z=part.orientationQuarterTurns*Math.PI/2;
        if(site.id==='coast_windmill'&&['driver','driven'].includes(slot))root.scale.setScalar(.62);
        const pumpPart=buildSitePart(site.id,slot,option.facts,{worn:!installing&&!selected});
        if(pumpPart){root.add(pumpPart);setPartHandle(pumpPart,option.allowedSettings?.indexOf(part.settingId)??0);}
        else if(option.kind==='valve'||option.kind==='baffle'||option.kind==='gate')root.rotation.y=(option.allowedSettings?.indexOf(part.settingId)??0)*Math.PI/6;
        root.userData.entityId=`socket:${site.id}:${slot}`;
        if(!pumpPart&&!(site.id==='coast_windmill'&&slot==='guard'))this.partGeometry(option.kind,option.facts,slot,root);assembly.parts.add(root);
        if(site.id==='creek_bridge'&&option.kind==='deck'&&!selected&&!installing){root.position.x=slot==='deck_left'?-4.2:4.2;root.scale.x=1/3;root.rotation.z=slot==='deck_left'?0.18:-0.18;}
        for(const port of option.ports) {
          const point=servicePoint(site.id,slot,portPosition(assembly.fixture,slot,part.optionId,port.id),coverOpen,artifact);
          const endpoint={partId:part.id,portId:port.id},active=JSON.stringify(endpoint)===JSON.stringify(snapshot.editor?.from)||JSON.stringify(endpoint)===JSON.stringify(snapshot.editor?.to);
          const tip=this.addMesh(new THREE.SphereGeometry(0.07,6,4),active?'amber':port.channel==='water'?'pipe':port.channel==='electrical'?'wire':'joint',assembly.markers);
          tip.geometry.dispose();tip.geometry=new THREE.SphereGeometry(site.id==='creek_bridge'?0.14:0.1,14,10);tip.material=portMaterial(port.direction,active);tip.renderOrder=6;
          tip.position.set(point.x,point.y,point.z);tip.visible=selected&&snapshot.editor?.tab==='connect';tip.userData.entityId=`port:${site.id}:${part.id}:${port.id}`;
        }
      }
      for(const edge of artifact.connections) {
        const from=artifact.parts.find((p)=>p.id===edge.from.partId)!,to=artifact.parts.find((p)=>p.id===edge.to.partId)!;
        const a=servicePoint(site.id,from.slotId,portPosition(assembly.fixture,from.slotId,from.optionId,edge.from.portId),coverOpen,artifact),b=servicePoint(site.id,to.slotId,portPosition(assembly.fixture,to.slotId,to.optionId,edge.to.portId),coverOpen,artifact);
        if(hasAuthoredMachine(site.id)){assembly.connections.add(pumpPipe(v(a.x,a.y,a.z),v(b.x,b.y,b.z),edge.channel==='water',edge.channel==='water'?assembly.flowMaterial:edge.channel==='electrical'?this.cableMaterial:site.id==='pier_hoist'?this.ropeMaterial:this.materials.get('joint')!));continue;}
        const curve=new THREE.CatmullRomCurve3([v(a.x,a.y,a.z),v(a.x,a.y+0.1,a.z+0.15),v(b.x,b.y+0.1,b.z+0.15),v(b.x,b.y,b.z)]);
        const tube=this.addMesh(new THREE.TubeGeometry(curve,8,edge.channel==='water'?0.06:0.025,5,false),edge.channel==='water'?'pipe':edge.channel==='electrical'?'wire':'joint',assembly.connections);if(edge.channel==='water')tube.material=assembly.flowMaterial;
      }
    }
    assembly.scaffold.visible=site.crew!=='none';assembly.scaffold.userData.crewState=site.crew;
    for(const [i,rig]of (this.workerRigs.get(site.id)??[]).entries())rig.update({phase:0,speed:0,work:site.crew==='working'||site.crew==='finishing',paused:snapshot.paused,seconds:snapshot.tick/60+i*.27},1/60);
    assembly.effect.visible=site.phase==='restoring';assembly.effect.scale.setScalar(1+Math.sin(site.restorationSeconds*Math.PI)*0.04);
    const feedback=restorationPresentation(site),time=snapshot.tick/60;
    const preview=describeRepair(getRepairScenario(site.id),{...site.draft,artifact});
    if(site.id==='pier_hoist')for(const part of assembly.parts.children)if(String(part.userData.entityId).endsWith(':boom'))part.rotation.z=artifact.parts.find(p=>p.slotId==='boom')!.orientationQuarterTurns*Math.PI/2+THREE.MathUtils.clamp(1-preview.ratio,-1,1)*.24;
    // Working responses use only approved installations; testing is a separate
    // local preview, never a permanent restoration or dependency grant.
    const active=installing||selected&&site.testSeconds>0;
    assembly.flowMaterial.emissive.set('#4395a0');assembly.flowMaterial.emissiveIntensity=active?.12:0;
    if(site.id==='village_pump')animatePipeFlow(assembly.connections,performance.now()/1000,active);
    else if(['tidal_sluice','upland_waterworks'].includes(site.id))for(const mesh of assembly.connections.children)mesh.scale.setScalar(active?1+Math.sin(time*3)*.008:1);
    for(const object of assembly.parts.children){const slot=String(object.userData.entityId??'').split(':').at(-1);if(!slot)continue;
      if(hasAuthoredMachine(site.id))animateSitePart(object,time,active);
      if(hasAuthoredMachine(site.id)&&selected)pulseGhosts(performance.now()/1000);
      if(!hasAuthoredMachine(site.id)&&['woodland_pathlight','ridge_beacon'].includes(site.id)&&['lamp','lens'].includes(slot))object.traverse(child=>{if(child instanceof THREE.Mesh)child.material=this.materials.get(installing?'glow':'amber')!;});
      if(site.id==='creek_bridge'&&slot==='brace_right'&&installing)object.rotation.z=artifact.parts.find(p=>p.slotId===slot)!.orientationQuarterTurns*Math.PI/2;
    }
    assembly.sparks.visible=feedback.spark>0;
    for(const [i,spark]of assembly.sparks.children.entries()){
      const angle=i/assembly.sparks.children.length*Math.PI*2,radius=.8+feedback.progress*1.5;
      spark.position.set(Math.cos(angle)*radius,.35+feedback.spark*(.8+i%4*.18),Math.sin(angle)*radius);spark.scale.setScalar(feedback.spark);
    }
    if(assembly.cargo&&assembly.cargoRope){
      const lift=feedback.lift,cycle=feedback.working?Math.sin(time*.65)*.08:0;
      assembly.cargo.position.set(.65,.24+lift*1.05+cycle,.05);
      for(const [i,bundle]of assembly.cargo.children.entries()){
        bundle.position.set((i-1)*.55*(1-lift),i*.09*lift,(i%2?-.28:.22)*(1-lift));
        bundle.rotation.y=Math.PI/2+(i-1)*.35*(1-lift);
      }
      // Cargo stays on/above the existing solid service board, not free-roam routes.
      const bottom=assembly.cargo.position.y+.3,top=2.65;
      assembly.cargoRope.visible=installing;assembly.cargoRope.position.set(.65,(top+bottom)/2,.05);assembly.cargoRope.scale.y=top-bottom;
      // The authored winch turns its own drum (animateSitePart); the cargo rises on the rope.
      this.host.dataset.landingRestoration=JSON.stringify({phase:site.phase,crew:site.crew,lift:feedback.lift,cargoHeight:assembly.cargo.position.y,completed:snapshot.restoredSiteIds.includes(site.id)});
    }
    if(site.id==='coast_windmill'&&this.windmill){
      this.windmill.getObjectByName('InputGearRoot')!.visible=false;this.windmill.getObjectByName('OutputGearRoot')!.visible=false;
      this.windmill.getObjectByName('StormDamage')!.visible=site.phase!=='restored';
      const guard=this.windmill.getObjectByName('GearCover')!;guard.visible=artifact.parts.some(p=>p.slotId==='guard');guard.rotation.y=coverOpen?-Math.PI/2:0;
      const turning=(site.phase==='restored'||site.testSeconds>0)&&!snapshot.paused;
      if(turning){
        const driver=artifact.parts.find(p=>p.slotId==='driver'),driven=artifact.parts.find(p=>p.slotId==='driven');
        const teeth=(part:typeof driver)=>Number(assembly.fixture.options.find(o=>o.id===part?.optionId)?.facts.teeth)||0;
        const a=teeth(driver),b=teeth(driven),time=snapshot.tick/60;
        for(const object of assembly.parts.children){const slot=String(object.userData.entityId??'').split(':').at(-1);if(slot==='driver')object.rotation.z=time*2*Math.PI;if(slot==='driven')object.rotation.z=-time*2*Math.PI*(a&&b?a/b:0);}
        if(site.phase==='restored')this.windmill.getObjectByName('SailRoot')!.rotation.z=time*.5;
      }
    }
    assembly.connections.visible=selected||site.testSeconds>0||site.phase==='restored'||site.id==='village_pump'&&!!this.devPump&&!selected;
  }
  setStyle(style:RenderStyle):void {
    this.style=style;
    for(const id of ['wood','metal','foliage','water']as const){const material=this.materials.get(id);if(material){material.color.set(style[id]);material.roughness=style.roughness;}}
    const ground=this.materials.get('ground');if(ground){const baseline=new THREE.Color(WARM_STYLE.ground),tint=new THREE.Color(style.ground);ground.color.setRGB(tint.r/baseline.r,tint.g/baseline.g,tint.b/baseline.b);ground.roughness=style.roughness;}
    this.applyLighting();if(this.host)this.host.dataset.style=style.id;
  }
  private applyLighting():void {
    if(this.appliedLightingStyle===this.style&&Math.abs(this.appliedLightingHeight-this.lightingHeight)<.002&&Math.abs(this.appliedDaylight-this.daylight)<.002)return;
    this.appliedLightingStyle=this.style;this.appliedLightingHeight=this.lightingHeight;this.appliedDaylight=this.daylight;
    const rig=withDaylight(lightingProfile(this.style,this.lightingHeight),this.daylight);
    if(this.scene.background instanceof THREE.Color)this.scene.background.copy(rig.fog);else this.scene.background=rig.fog.clone();
    const envFog=this.importedEnvironment?.userData.fog as [number,number]|undefined,fogNear=this.importedEnvironment?envFog?.[0]??115:rig.fogNear,fogFar=this.importedEnvironment?envFog?.[1]??260:rig.fogFar;
    if(this.scene.fog instanceof THREE.Fog){this.scene.fog.color.copy(rig.fog);this.scene.fog.near=fogNear;this.scene.fog.far=fogFar;}else this.scene.fog=new THREE.Fog(rig.fog,fogNear,fogFar);
    this.key.color.copy(rig.keyColor);this.key.intensity=rig.keyIntensity;this.fill.color.copy(rig.sky);this.fill.groundColor.copy(rig.bounce);this.fill.intensity=rig.fillIntensity;
    this.bounce.color.copy(rig.bounce);this.bounce.intensity=.45;this.renderer.toneMappingExposure=rig.exposure;
    this.grade.uniforms.powRGB!.value.copy(rig.gradePower);this.grade.uniforms.mulRGB!.value.copy(rig.gradeMultiply);this.grade.uniforms.addRGB!.value.copy(rig.gradeLift);
    this.host.dataset.lightingRig=JSON.stringify({stage:'C1',upland:rig.upland,keyOffset:this.style.keyOffset,keyIntensity:rig.keyIntensity,fillIntensity:rig.fillIntensity,exposure:rig.exposure,fog:[rig.fogNear,rig.fogFar],aoRadius:this.ao.kernelRadius,bloom:[this.bloom.strength,this.bloom.threshold]});
  }
  resize(width:number,height:number,pixelRatio:number):void {
    this.width=Math.max(1,width);this.height=Math.max(1,height);const ratio=Math.min(width<900?1.5:2,pixelRatio);
    this.renderer.setPixelRatio(ratio);this.renderer.setSize(this.width,this.height);this.composer.setPixelRatio(ratio);this.composer.setSize(this.width,this.height);this.ao.setSize(Math.max(1,Math.ceil(this.width*ratio/2)),Math.max(1,Math.ceil(this.height*ratio/2)));
  }
  render(snapshot:WorldSnapshot,frame:RenderFrame):void {
    this.snapshot=snapshot;this.layout=frame.repairLayout??null;
    const {position,previousPosition,velocity}=snapshot.player,alpha=frame.alpha;
    this.player.position.set(previousPosition.x+(position.x-previousPosition.x)*alpha,previousPosition.y+(position.y-previousPosition.y)*alpha,previousPosition.z+(position.z-previousPosition.z)*alpha);this.player.rotation.y=snapshot.player.heading;
    // The pump close-up is a workbench view: the restorer steps out of frame so every socket stays visible.
    this.player.visible=!(snapshot.editor?.stage==='construct'&&!!snapshot.inspectionId);
    if(this.heroRig){const site=snapshot.sites.find(s=>s.id===snapshot.inspectionId);this.heroRig.update({phase:snapshot.player.gaitPhase,speed:Math.hypot(velocity.x,velocity.z),work:!!site&&site.testSeconds>0,paused:snapshot.paused,seconds:snapshot.tick/60},frame.elapsedSeconds);this.host.dataset.heroRig=JSON.stringify(this.heroRig.diagnostics());}
    // Building zooms in on the machine; the bridge spans the creek so it needs a wider view.
    const buildSpan=snapshot.editor?.stage==='construct'&&snapshot.inspectionId?({creek_bridge:11.5,coast_windmill:7.6} as Record<string,number>)[snapshot.inspectionId]??6.6:0;
    this.council?.update(Math.min(frame.elapsedSeconds,.1),performance.now()/1000);this.windmillPads?.update(snapshot,Math.min(frame.elapsedSeconds,.1));this.siteCouncils?.update(Math.min(frame.elapsedSeconds,.1),this.councilShot?null:{x:this.target.x,z:this.target.z});
    const councilShot=this.siteCouncils?.councils.has(this.councilShot?.siteId??'')?this.councilShot:null;
    // A whole-council shot is wide enough to hold every member; a member shot is close.
    const councilSpan=councilShot?(councilShot.member===null?this.councilSpread(councilShot.siteId):4.6)*(this.width<1000?1.1:1):0;
    const preset=this.importedEnvironment?{...WALK_CAMERA,pitchDegrees:48,span:frame.overview?78:this.devCameraAt?.[3]||(councilShot?councilSpan:buildSpan?buildSpan*(this.width<1000?1.08:1):this.width<1000?11:13),distance:76}:WALK_CAMERA,station=snapshot.sites.find((s)=>s.id===snapshot.inspectionId),yaw=preset.yawDegrees*Math.PI/180,pitch=preset.pitchDegrees*Math.PI/180;
    const up=v(-Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),-Math.cos(yaw)*Math.sin(pitch)),right=v(Math.cos(yaw),0,-Math.sin(yaw));
    const lookahead=v(velocity.x*0.24,0,velocity.z*0.24).clampLength(0,0.8);
    const desired=this.player.position.clone().add(lookahead).add(v(0,preset.targetHeight,0)).addScaledVector(up,0.5);
    // Brief attention cue only after installation starts, nearby and without
    // interrupting another repair. No camera movement grants progress.
    const finishing=!station&&!frame.overview?snapshot.sites.find(site=>site.phase==='restoring'&&Math.hypot(site.position.x-position.x,site.position.z-position.z)<7):null;
    if(finishing&&!matchMedia('(prefers-reduced-motion: reduce)').matches)desired.lerp(v(finishing.position.x,finishing.position.y+1.1,finishing.position.z),restorationPresentation(finishing).spark*.25);
    if(!station&&snapshot.focusId==='tidal_sluice')desired.addScaledVector(right,0.16*preset.span*this.width/this.height).addScaledVector(up,-0.2);
    if(!station&&snapshot.focusId==='coast_windmill')desired.addScaledVector(right,0.04*preset.span*this.width/this.height);
    if(station) {
      desired.lerp(v(station.position.x,station.position.y+0.9,station.position.z),0.4);
      const region=this.layout?.protectedScene??repairRegions(this.width,this.height).scene;
      desired.addScaledVector(right,-((region.x+region.width/2)/this.width-0.5)*preset.span*this.width/this.height);
      desired.addScaledVector(up,((region.y+region.height*(this.layout?.keyboardOpen?0.48:0.58))/this.height-0.5)*preset.span);
    }
    // Fixed-angle service overview from the real west-anchored workwalk.
    // It never changes span or actor size, and also applies outside inspection.
    const bridgeService=!this.importedEnvironment&&(station?.id??snapshot.focusId)==='creek_bridge'&&position.z>-0.4&&!this.layout?.keyboardOpen;
    if(bridgeService) {
      desired.set(0,6+preset.targetHeight,-2);
      const centreX=station?(this.width>=1000?750:this.width<750?436:450):this.width/2+0.329*this.height/preset.span;
      const centreY=this.height*(this.width>=1000?0.365:0.425);
      desired.addScaledVector(right,-(centreX/this.width-0.5)*preset.span*this.width/this.height);
      desired.addScaledVector(up,(centreY/this.height-0.5)*preset.span);
    }
    if(frame.overview&&this.importedEnvironment)desired.set(0,2,0);
    if(this.devCameraAt&&this.devCameraAt.length>=2&&!frame.overview)desired.set(this.devCameraAt[0]!,(this.devCameraAt[2]??1)+preset.targetHeight,this.devCameraAt[1]!);
    // Council reveal: frame the circle (or a speaker) a little high, above the reveal panel (wins over dev framing).
    if(councilShot&&!frame.overview){desired.copy(this.councilFocus(councilShot)).addScaledVector(up,-preset.span*0.12);}
    this.target.lerp(desired,1-Math.exp(-Math.min(frame.elapsedSeconds,0.1)/preset.followSeconds));
    // Ease between spans so close-ups (pump build, council) zoom instead of cutting.
    this.spanNow=this.spanNow?THREE.MathUtils.lerp(this.spanNow,preset.span,1-Math.exp(-Math.min(frame.elapsedSeconds,0.1)/0.35)):preset.span;
    this.camera.top=this.spanNow/2;this.camera.bottom=-this.spanNow/2;this.camera.right=this.spanNow/2*this.width/this.height;this.camera.left=-this.camera.right;this.camera.updateProjectionMatrix();
    this.camera.position.copy(this.target).add(v(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(preset.distance));this.camera.lookAt(this.target);
    this.importedHero.copy(this.player.position).y+=.85;this.importedEye.copy(this.camera.position);
    // Only what truly covers the restorer fades; walking past a house leaves its roof in place.
    const views:ProtectedView[]=[{point:this.importedHero,radius:0.55}];
    const service=station??snapshot.sites.find(site=>site.id===snapshot.focusId);
    if(service)views.push({point:v(service.position.x,service.position.y+1.05,service.position.z),radius:station?1.6:1.2});
    this.host.dataset.cutawayComponents=String(this.cutaway?.update(this.importedEye,views,!frame.overview)??0);
    this.key.position.copy(this.target).add(v(...this.style.keyOffset));this.key.target.position.copy(this.target);
    this.bounce.position.copy(this.target).add(v(24,18,-28));this.bounce.target.position.copy(this.target);
    this.lightingHeight=THREE.MathUtils.lerp(this.lightingHeight,position.y,1-Math.exp(-Math.min(frame.elapsedSeconds,.1)/.6));
    // The overview (title screen) shows the island at dawn; play starts at night and lightens with each repair.
    const dayTarget=frame.overview?.85:this.devDaylight??snapshot.restoredSiteIds.length/8;
    this.daylight+=(dayTarget-this.daylight)*(1-Math.exp(-Math.min(frame.elapsedSeconds,.1)/1.6));this.host.dataset.daylight=this.daylight.toFixed(3);
    this.applyLighting();
    // Morning: when the eighth repair lands during play, every council waves at the sunrise.
    {const count=snapshot.restoredSiteIds.length;if(this.restoredSeen>=0&&count===snapshot.sites.length&&this.restoredSeen<count&&this.siteCouncils){const yaw=WALK_CAMERA.yawDegrees*Math.PI/180;for(const council of this.siteCouncils.councils.values())council.celebrate(p=>({x:p.x+Math.sin(yaw)*3,z:p.z+Math.cos(yaw)*3}));}this.restoredSeen=count;}
    this.nightLights?.update(Math.min(frame.elapsedSeconds,.1),this.daylight,new Set([...snapshot.restoredSiteIds,...this.devRestored]));
    if(Math.abs(this.dimmedAt-this.daylight)>.004){this.dimmedAt=this.daylight;const k=THREE.MathUtils.lerp(.32,1,THREE.MathUtils.smoothstep(this.daylight,0,.9));for(const d of this.nightDimmed)d.material.color.copy(d.base).multiplyScalar(k);}
    {const site=snapshot.sites.find(s=>s.id===snapshot.inspectionId);const want=site?(1-THREE.MathUtils.smoothstep(this.daylight,.55,.95))*60:0;this.workLight.intensity+= (want-this.workLight.intensity)*Math.min(1,frame.elapsedSeconds*4);
      if(site){this.workLight.position.set(site.position.x+2.5,site.position.y+7,site.position.z+3.5);this.workLight.target.position.set(site.position.x,site.position.y+.5,site.position.z);}}
    // Show the restorer's outline through a building that hides it (buildings never cut away).
    const occluders=this.importedEnvironment?.userData.occluders as THREE.Object3D[]|undefined;
    if(this.heroRig&&occluders&&this.frames%3===0){
      const chest=this.player.position.clone().add(v(0,.9,0)),ndc=chest.clone().project(this.camera);
      this.raycaster.setFromCamera(new THREE.Vector2(ndc.x,ndc.y),this.camera);
      const hit=this.raycaster.intersectObjects(occluders,false)[0],heroDistance=this.raycaster.ray.origin.distanceTo(chest);
      this.heroRig.setOccluded(!!hit&&hit.distance<heroDistance-.3);
    }
    const restored=new Set(snapshot.restoredSiteIds);
    // Display-only environment response to restored sites; it never grants anything.
    // The village shows which pump design is installed (display only, from the approved build).
    const pumpSite=snapshot.sites.find(s=>s.id==='village_pump'),pumpBuild=pumpSite?.approvedArtifact??(this.devPump?this.devPumpArtifact():null);
    const villageDesign=pumpBuild?inferPumpDesign(getRepairScenario('village_pump'),{siteId:'village_pump',artifact:pumpBuild,rationale:''}):null;
    (this.importedEnvironment?.userData.setVillageDesign as ((d:string|null)=>void)|undefined)?.(villageDesign);
    (this.importedEnvironment?.userData.update as ((seconds:number,restored:ReadonlySet<string>,dt:number)=>void)|undefined)?.(snapshot.tick/60,this.devRestored.length?new Set([...restored,...this.devRestored]):restored,frame.elapsedSeconds);
    for(const dressing of this.dressingRoots)dressing.root.visible=sceneryVisible(dressing,restored);
    if(this.nature){this.nature.update(snapshot.tick/60,snapshot.restoredSiteIds.length/snapshot.sites.length,restored);this.host.dataset.natureStats=JSON.stringify({...this.nature.group.userData.natureStats,visibleBatches:this.nature.group.userData.visibleNatureBatches});}
    const water=this.surfaces?.water;
    if(water?.normalMap){water.normalMap.offset.set(snapshot.tick/60*.012,snapshot.tick/60*.007);}
    for(const patch of this.terrainPatches){const open=patch.requires.every((id)=>restored.has(id));patch.mesh.material=this.materials.get(patch.id==='bridge-service'?'wood':'ground')!;patch.mesh.visible=open;}
    for(const gate of this.gates.values())gate.root.visible=gate.requires.some((id)=>!restored.has(id));
    for(const site of snapshot.sites)this.updateAssembly(site,site.id===snapshot.inspectionId,snapshot);
    this.renderer.setScissorTest(false);this.renderer.setViewport(0,0,this.width,this.height);this.renderer.info.reset();this.composer.render(frame.elapsedSeconds);
    if(station&&snapshot.editor?.stage==='construct'&&(this.layout?.inset.width??1)>0&&(this.layout?.inset.height??1)>0) {
      const region=this.layout?.inset??repairRegions(this.width,this.height).inset,inspect=INSPECT_CAMERA,ip=inspect.pitchDegrees*Math.PI/180;
      let inspectionTarget=v(station.position.x,station.position.y+inspect.targetHeight,station.position.z);
      if(station.id==='creek_bridge'&&snapshot.editor){const selected=socketPosition(station.id,snapshot.editor.slotId);inspectionTarget.add(v(selected.x*0.6,selected.y*0.2,selected.z*0.4));}
      this.inspectionCamera.top=inspect.span/2;this.inspectionCamera.bottom=-inspect.span/2;this.inspectionCamera.right=inspect.span/2*region.width/region.height;this.inspectionCamera.left=-this.inspectionCamera.right;this.inspectionCamera.updateProjectionMatrix();
      this.inspectionCamera.position.copy(inspectionTarget).add(v(Math.sin(yaw)*Math.cos(ip),Math.sin(ip),Math.cos(yaw)*Math.cos(ip)).multiplyScalar(inspect.distance));this.inspectionCamera.lookAt(inspectionTarget);
      this.cutaway?.update(this.inspectionCamera.position,[{point:inspectionTarget,radius:3.2}]);
      const bottom=this.height-region.y-region.height;this.renderer.setViewport(region.x,bottom,region.width,region.height);this.renderer.setScissor(region.x,bottom,region.width,region.height);this.renderer.setScissorTest(true);this.renderer.clear();this.renderer.render(this.scene,this.inspectionCamera);this.renderer.setScissorTest(false);this.renderer.setViewport(0,0,this.width,this.height);this.host.dataset.inspectView=JSON.stringify(region);
    }else this.host.dataset.inspectView='';
    this.host.dataset.frames=String(++this.frames);this.host.dataset.triangles=String(this.renderer.info.render.triangles);this.host.dataset.shadowReady=String(this.renderer.shadowMap.enabled&&this.key.castShadow&&this.key.shadow.map!==null);
    const gl=this.renderer.getContext(),programs=this.renderer.info.programs??[];this.host.dataset.programsLinked=String(programs.length>0&&programs.every((program)=>gl.getProgramParameter(program.program as WebGLProgram,gl.LINK_STATUS)));
  }
  pick(point:Readonly<{x:number;y:number}>):string|null {
    const px=(point.x+1)/2*this.width,py=(1-point.y)/2*this.height,region=this.layout?.inset??repairRegions(this.width,this.height).inset;
    const inset=!!this.host.dataset.inspectView&&px>=region.x&&px<=region.x+region.width&&py>=region.y&&py<=region.y+region.height;
    const anchor=projectedHit(this.hitAnchors(),px,py,inset?'inset':'world',this.snapshot?.editor?.tab==='connect');
    if(anchor)return anchor.kind==='socket'?`socket:${anchor.siteId}:${anchor.slotId}`:`port:${anchor.siteId}:${anchor.endpoint!.partId}:${anchor.endpoint!.portId}`;
    this.raycaster.setFromCamera(inset?new THREE.Vector2((px-region.x)/region.width*2-1,1-(py-region.y)/region.height*2):new THREE.Vector2(point.x,point.y),inset?this.inspectionCamera:this.camera);
    for(const hit of this.raycaster.intersectObjects(this.scene.children,true)) {
      let object:THREE.Object3D|null=hit.object;if(!object.visible)continue;
      while(object){if(!object.visible)break;if(typeof object.userData.entityId==='string'){const id=object.userData.entityId as string;if(!this.snapshot?.inspectionId||id.startsWith(this.snapshot.editor?.tab==='connect'?'port:':'socket:'))return id;}object=object.parent;}
    }
    // A click that misses every part but lands near a site on screen still means that site.
    if(!inset&&!this.snapshot?.inspectionId){let best:string|null=null,bestDistance=Math.max(70,this.height*0.09);
      for(const[id,assembly]of this.assemblies){const p=this.project(assembly.root.position.clone().add(v(0,0.7,0)),this.camera,'world');const d=Math.hypot(p.x-px,p.y-py);if(p.visible&&d<bestDistance){bestDistance=d;best=id;}}
      return best;}
    return null;
  }
  private project(position:THREE.Vector3,camera:THREE.Camera,view:'world'|'inset'):{x:number;y:number;visible:boolean} {
    const point=position.clone().project(camera),region=view==='inset'?(this.layout?.inset??repairRegions(this.width,this.height).inset):{x:0,y:0,width:this.width,height:this.height};
    return {x:region.x+(point.x+1)/2*region.width,y:region.y+(1-point.y)/2*region.height,visible:Math.abs(point.x)<1&&Math.abs(point.y)<1&&point.z>=-1&&point.z<=1};
  }
  private councilSpread(siteId:string):number {
    const council=this.siteCouncils?.councils.get(siteId);if(!council)return 7.2;
    const c=council.centre();let r=0;for(const actor of council.actors)r=Math.max(r,Math.hypot(actor.root.position.x-c.x,actor.root.position.z-c.z));
    return THREE.MathUtils.clamp(r*2+3.2,7.2,15);
  }
  private councilFocus(shot:NonNullable<CouncilShot>):THREE.Vector3 {
    const council=this.siteCouncils!.councils.get(shot.siteId)!,c=council.centre();
    if(shot.member===null)return c.add(v(0,0.7,0));
    const p=council.actors[shot.member]!.root.position;return c.lerp(p,0.65).setY(p.y+1.0);
  }
  councilStage():CouncilStage|null {
    const councils=this.siteCouncils;if(!councils)return null;
    const at=(siteId:string)=>councils.councils.get(siteId)??null;
    // Members turn to a point between them and the fixed camera so faces read.
    const cameraward=(p:THREE.Vector3)=>({x:p.x+Math.sin(WALK_CAMERA.yawDegrees*Math.PI/180)*3,z:p.z+Math.cos(WALK_CAMERA.yawDegrees*Math.PI/180)*3});
    return {
      setShot:(shot)=>{this.councilShot=shot;},
      setFire:(mood)=>this.council?.setFire(mood),
      size:(siteId)=>at(siteId)?.actors.length??0,
      activity:(siteId,i)=>at(siteId)?.spots[i]?.activity??null,
      engage:(siteId,i)=>{const c=at(siteId);const a=c?.actors[i];if(c&&a)c.engage(i,cameraward(a.root.position));},
      release:(siteId,i)=>at(siteId)?.release(i),
      gesture:(siteId,i,g)=>at(siteId)?.actors[i]?.vote(g),
      settle:(siteId,i)=>at(siteId)?.actors[i]?.settle(),
      bubble:(siteId,i)=>{const c=at(siteId);if(!c?.actors[i])return null;const p=this.project(c.head(i),this.camera,'world');return p.visible?{x:p.x,y:p.y}:null;},
      beacon:(siteId)=>{const c=at(siteId);if(!c?.actors[0])return null;const p=this.project(c.head(0).add(v(0,0.5,0)),this.camera,'world');return p.visible?{x:p.x,y:p.y}:null;},
      centre:(siteId)=>{const c=at(siteId);if(!c)return null;const p=c.centre();return {x:p.x,z:p.z};},
    };
  }
  objectiveAnchor(siteId:string):Readonly<{x:number;y:number}>|null {
    const assembly=this.assemblies.get(siteId);if(!assembly)return null;
    const point=this.project(assembly.root.position.clone().add(v(0,3.1,0)),this.camera,'world');
    return {x:point.x,y:point.y};
  }
  hitAnchors():readonly HitAnchor[] {
    const snapshot=this.snapshot,station=snapshot?.sites.find((s)=>s.id===snapshot.inspectionId),assembly=station?this.assemblies.get(station.id):null;
    if(!snapshot||!station?.draft||!assembly||snapshot.editor?.stage!=='construct')return [];
    this.camera.updateMatrixWorld();this.inspectionCamera.updateMatrixWorld();const anchors:HitAnchor[]=[];
    const coverOpen=snapshot.editor.stage==='construct'&&station.testSeconds===0;
    for(const view of ['world','inset']as const) {
      const camera=view==='world'?this.camera:this.inspectionCamera;
      const pump=station.id==='village_pump';
      for(const slot of assembly.fixture.slotIds) {
        if(this.layout?.blueprint&&!this.layout.blueprint.includes(slot))continue;
        const p=servicePoint(station.id,slot,socketPosition(station.id,slot),coverOpen,station.draft.artifact),point=v(p.x,p.y,p.z+(pump?0:0.38)).add(assembly.root.position);
        anchors.push({kind:'socket',siteId:station.id,slotId:slot,label:slot.replaceAll('_',' '),endpoint:null,view,...this.project(point,camera,view)});
      }
      for(const part of station.draft.artifact.parts)for(const port of assembly.fixture.options.find((o)=>o.id===part.optionId)?.ports??[]) {
        const p=servicePoint(station.id,part.slotId,portPosition(assembly.fixture,part.slotId,part.optionId,port.id),coverOpen,station.draft.artifact),point=v(p.x,p.y,p.z).add(assembly.root.position);
        anchors.push({kind:'port',siteId:station.id,slotId:part.slotId,label:`${part.slotId.replaceAll('_',' ')} ${port.id}`,endpoint:{partId:part.id,portId:port.id},view,...this.project(point,camera,view)});
      }
    }return anchors;
  }
  private screenBox(box:THREE.Box3):{x:number;y:number;width:number;height:number} {
    const points=[];
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(this.project(v(x,y,z),this.camera,'world'));
    const x=Math.min(...points.map((p)=>p.x)),y=Math.min(...points.map((p)=>p.y));return{x,y,width:Math.max(...points.map((p)=>p.x))-x,height:Math.max(...points.map((p)=>p.y))-y};
  }
  private objectBounds(root:THREE.Object3D):{x:number;y:number;width:number;height:number} {
    const points:{x:number;y:number}[]=[];
    root.traverse((object)=>{if(!(object instanceof THREE.Mesh)||!object.visible)return;const positions=object.geometry.getAttribute('position');for(let i=0;i<positions.count;i++){const point=object.getVertexPosition(i,v(0,0,0)).applyMatrix4(object.matrixWorld);points.push(this.project(point,this.camera,'world'));}});
    if(!points.length)return{x:0,y:0,width:0,height:0};
    const x=Math.min(...points.map((p)=>p.x)),y=Math.min(...points.map((p)=>p.y));return{x,y,width:Math.max(...points.map((p)=>p.x))-x,height:Math.max(...points.map((p)=>p.y))-y};
  }
  measureComposition():Readonly<Record<string,unknown>> {
    this.scene.updateMatrixWorld(true);this.camera.updateMatrixWorld(true);
    const hero=this.objectBounds(this.player),selected=this.snapshot?.inspectionId??this.snapshot?.focusId??null;
    const assemblies=Object.fromEntries([...this.assemblies].map(([id,a])=>[id,this.objectBounds(a.parts)]));
    const structures=Object.fromEntries([...this.structures].filter(([,s])=>s.children.length).map(([id,s])=>[id,this.objectBounds(s)]));
    const visible=(b:{x:number;y:number;width:number;height:number})=>b.x+b.width>0&&b.x<this.width&&b.y+b.height>0&&b.y<this.height;
    const restored=new Set(this.snapshot?.restoredSiteIds??[]);
    const crowns=this.foliageBounds.filter(tree=>tree.requires.every(id=>restored.has(id))).map(({box})=>this.screenBox(box)).filter(visible);
    const coverage:Record<string,number>={},samples=24*14;
    for(let y=0;y<14;y++)for(let x=0;x<24;x++) {
      this.raycaster.setFromCamera(new THREE.Vector2((x+0.5)/24*2-1,1-(y+0.5)/14*2),this.camera);
      const hit=this.raycaster.intersectObjects(this.scene.children,true).find((h)=>{let p:THREE.Object3D|null=h.object;while(p){if(!p.visible)return false;p=p.parent;}return true;});
      let object:THREE.Object3D|null=hit?.object??null,category='background';while(object){if(typeof object.userData.category==='string'){category=object.userData.category;break;}object=object.parent;}
      coverage[category]=(coverage[category]??0)+100/samples;
    }
    return {viewport:{width:this.width,height:this.height},camera:WALK_CAMERA,inspectionCamera:INSPECT_CAMERA,selected,hero,heroFeet:this.project(this.player.position,this.camera,'world'),assemblies,structures,visibleCrowns:crowns.length,coverageMethod:'24x14 nearest-visible-geometry ray samples before HUD occlusion',coverage,protectedRegion:this.layout?.protectedScene??repairRegions(this.width,this.height).scene,actualLayout:this.layout,placeholder:true};
  }
  dispose():void {
    for(const assembly of this.assemblies.values())assembly.flowMaterial.dispose();
    this.disposed=true;this.repairProps?.dispose();this.nature?.dispose();this.heroRig?.dispose();for(const rigs of this.workerRigs.values())for(const rig of rigs)rig.dispose();
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
    this.scene.traverse((o)=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
    if(this.surfaces)for(const id of ['ground','wood','stone','water']as const)materials.delete(this.surfaces[id]);
    for(const g of geometries)g.dispose();for(const m of materials)m.dispose();this.surfaces?.dispose();for(const texture of this.textures)texture.dispose();for(const pass of this.composer.passes)pass.dispose();this.composer.dispose();this.renderer.dispose();this.renderer.domElement.remove();
  }
}
