import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {openGame, state, click, press, tab, place, join as joinPorts, actions, record} from './browser-play.mjs';

// Run against the EXISTING 5173 preview. The SSR loader has no listener/HMR.
// All browser evaluation below is observation. Only real browser inputs change
// the expedition; CPU geometry/physics only decide which keys to press.
const root=fileURLToPath(new URL('../',import.meta.url));
const stamp=new Date().toISOString();
const out=join(root,'artifacts/clarity-journey',stamp.replaceAll(':','-').replaceAll('.','-'));
await mkdir(out,{recursive:true});
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function provenance(){
  const files=git('ls-files','--cached','--others','--exclude-standard','--','src','assets','index.html','vite.config.ts','package.json','package-lock.json').split('\n').filter(Boolean);
  const entries=await Promise.all([...new Set(files)].sort().map(async file=>[file,hash(await readFile(join(root,file)))]));
  return {commit:git('rev-parse','HEAD'),runtimeSourceSha256:hash(JSON.stringify(entries)),files:Object.fromEntries(entries),workingTree:git('status','--porcelain','--','src','assets','index.html','vite.config.ts','tools/clear-island-journey.mjs')};
}
const report={scope:'Imported-island all-eight local expedition, CPU BFS over actual visible geometry, real keyboard walking and repair inputs, typed explanations, finale, supported Save and Continue reload. No wallet interaction, seeded state, teleport or injected completion.',started:stamp,source:await provenance(),frames:[],routes:[],repairs:[],checks:[],navigations:[],complete:false};
// One-line council answers (15-200 characters), as the answer step requires.
const explanations={
  pier_hoist: "Crews stay on the marked access path and lift slowly with the guarded pulley so loads never swing over the nests.",
  village_pump: "Fast supply for the village; relief water goes to the soakaway and we run it in short daytime spells to limit noise.",
  tidal_sluice: "The gate gives the pools a steady share, the creek keeps the rest, the shield protects the bank and debris stays in the rack.",
  creek_bridge: "Two opposed braces carry the deck from the bank shoes, so nothing stands in the channel; the tensioned rail keeps walkers safe.",
  coast_windmill: "The guarded gear pair turns the generator at a safe speed, and maintenance keeps to the service track away from the gulls.",
  woodland_pathlight: "The shield points light down onto the path only, and the sleeved cable cannot snag walkers or animals.",
  upland_waterworks: "The village gets its full share and the habitat a steady trickle; we will clean the filter before the dry spell.",
  ridge_beacon: "The reflector aims at the coast, the shield blocks inland and the nests, and it stands on the safe plinth."
};
let browser,context,page,errors=[],model,phase='geometry';
globalThis.ProgressEvent??=class extends Event{constructor(type,details){super(type);Object.assign(this,details);}};
async function geometryScene(path){
  const bytes=await readFile(new URL(path,import.meta.url)),length=bytes.readUInt32LE(12);
  const json=JSON.parse(bytes.subarray(20,20+length).toString()),binary=bytes.subarray(28+length);
  // Omit only texture decoding in Node. Vertex data/transforms remain exact.
  delete json.images;delete json.textures;
  for(const material of json.materials??[]){
    delete material.normalTexture;delete material.occlusionTexture;delete material.emissiveTexture;
    if(material.pbrMetallicRoughness){delete material.pbrMetallicRoughness.baseColorTexture;delete material.pbrMetallicRoughness.metallicRoughnessTexture;}
  }
  json.buffers[0].uri=`data:application/octet-stream;base64,${binary.toString('base64')}`;
  return (await new GLTFLoader().parseAsync(JSON.stringify(json),'')).scene;
}
async function importedModel(){
  const server=await createServer({root,configFile:false,server:{middlewareMode:true,hmr:false,ws:false,watch:null},appType:'custom'});
  try{
    const [world,terrain,steering,props,scenery,stylized]=await Promise.all([
      server.ssrLoadModule('/src/render/imported-world.ts'),server.ssrLoadModule('/src/domain/terrain.ts'),
      server.ssrLoadModule('/src/input/corridor-steering.ts'),server.ssrLoadModule('/src/render/environment/repair-props.ts'),
      server.ssrLoadModule('/src/content/imported-scenery.ts'),server.ssrLoadModule('/src/render/island/stylized-world.ts'),
    ]);
    const base=stylized.buildStylizedIsland(),stock=new Map();
    const placements=[...base.dressing,...scenery.sceneryCandidates(base.level)];
    for(const kind of new Set(placements.map(p=>p.kind))){const definition=props.REPAIR_PROP_SOURCES[kind];assert(definition,`Missing imported-scene asset definition for ${kind}`);stock.set(kind,await geometryScene(`../assets/props/kenney-${definition.pack}/${kind}.glb`));}
    const library={create(kind){const item=stock.get(kind).clone(true);item.scale.multiplyScalar(props.REPAIR_PROP_SOURCES[kind].scale);return item;},release:item=>item.removeFromParent()};
    const windmill=await geometryScene('../assets/windmill/headland-windmill.glb');
    windmill.getObjectByName('InputGearRoot').visible=false;windmill.getObjectByName('OutputGearRoot').visible=false;
    const imported=world.withImportedEquipment(base,library,windmill);
    return {level:imported.level,stats:imported.stats,terrain,steering};
  }finally{await server.close();}
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const normalizeGeometry=(value)=>typeof value==='number'?Math.round(value*1e8)/1e8:Array.isArray(value)?value.map(normalizeGeometry):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,normalizeGeometry(item)])):value;
// Mirrors World focusSite(): of the sites in range, the one the restorer is relatively deepest into.
const reach=id=>id==='creek_bridge'?6.3:3.5;
function focusAt(position){let best=null,depth=1;for(const[id,p]of Object.entries(model.level.sitePositions)){const d=distance(p,position)/reach(id);if(d<depth){depth=d;best=id;}}return best;}
// A route ends only where the target leads every other site by a clear margin, so stopping
// within the walk tolerance (0.23 m) cannot hand focus to a neighbour.
function clearFocus(position,siteId){const own=distance(model.level.sitePositions[siteId],position)/reach(siteId);return focusAt(position)===siteId&&Object.entries(model.level.sitePositions).every(([id,p])=>id===siteId||distance(p,position)/reach(id)>own+.12);}
function safeSegment(from,to,restored){
  let position=from;
  const count=Math.max(1,Math.ceil(distance(from,to)/.09));
  for(let i=1;i<=count;i++){
    const x=from.x+(to.x-from.x)*i/count,z=from.z+(to.z-from.z)*i/count;
    position=model.terrain.traverse(model.level,position,x-position.x,z-position.z,restored).position;
    if(Math.hypot(position.x-x,position.z-z)>1e-5)return null;
  }
  if(!model.terrain.dryStandingGround(model.level,position,restored))return null;
  // Keep routes off ground at the very edge of the 38 degree walking limit: the footprint samples must
  // all be a little flatter, so the real-input steering always has room to move.
  for(const [dx,dz] of [[0,0],[.3,0],[-.3,0],[0,.3],[0,-.3]]){const g=model.terrain.sampleGround(model.level,position.x+dx,position.z+dz,restored);if(!g||g.normal.y<.8)return null;}
  return position;
}
function findPath(start,siteId,restored){
  const begin=performance.now(),step=.4,queue=[{x:0,z:0,position:start,parent:-1}],seen=new Set(['0,0']);
  const target=model.level.sitePositions[siteId],radius=(siteId==='creek_bridge'?6.3:3.5)-.65;
  let cursor=0,found=-1;
  while(cursor<queue.length){
    const index=cursor++,cell=queue[index];
    if(distance(cell.position,target)<radius&&clearFocus(cell.position,siteId)){found=index;break;}
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
      const x=cell.x+dx,z=cell.z+dz,key=`${x},${z}`;if(seen.has(key))continue;
      const end={x:start.x+x*step,z:start.z+z*step};
      const b=model.level.bounds;if(end.x<b.minX||end.x>b.maxX||end.z<b.minZ||end.z>b.maxZ)continue;
      const position=safeSegment(cell.position,end,restored);
      if(position){seen.add(key);queue.push({x,z,position,parent:index});}
    }
  }
  assert(found>=0,`No imported geometry BFS path to ${siteId}; visited ${queue.length} cells from ${JSON.stringify(start)}`);
  const raw=[];for(let i=found;i>=0;i=queue[i].parent)raw.push(queue[i].position);raw.reverse();
  // Keep corners from BFS, shorten only through exact traversable geometry.
  const points=[raw[0]];
  for(let i=0;i<raw.length-1;){let next=i+1;for(let j=i+2;j<raw.length&&distance(raw[i],raw[j])<=2;j++)if(safeSegment(raw[i],raw[j],restored))next=j;points.push(raw[next]);i=next;}
  return {siteId,gridStep:step,visited:queue.length,elapsedMs:Math.round(performance.now()-begin),rawPoints:raw.length,points};
}
async function settled(){await page.waitForFunction(()=>{const s=JSON.parse(document.getElementById('world').dataset.domainState);return Math.hypot(s.player.velocity.x,s.player.velocity.z)<.02;},null,{timeout:5000});}
async function walkPoint(target){
  let stalls=0;
  for(let i=0;i<70;i++){
    await settled();const snapshot=await state(page),position=snapshot.player.position,restored=new Set(snapshot.restoredSiteIds);
    assert.equal(snapshot.inspectionId,null);assert.equal(snapshot.paused,false);
    const diagnostic=model.steering.standingDiagnostic(model.level,position,restored);
    assert.equal(diagnostic.failure,null,JSON.stringify(diagnostic));
    if(distance(position,target)<.23)return;
    const pulse=model.steering.planPulse(model.level,snapshot.player,target,restored,{from:position,to:target,radius:.7});
    assert(pulse,`No safe real-input pulse to ${JSON.stringify(target)} from ${JSON.stringify(diagnostic)}`);
    const keys=[...(pulse.input.brisk?['ShiftLeft']:[]),...pulse.keys];
    const index=await page.evaluate(()=>window.__journeyKeyEvents.length);
    try{for(const key of keys)await page.keyboard.down(key);await new Promise(resolve=>setTimeout(resolve,pulse.holdMs));}
    finally{for(const key of keys)await page.keyboard.up(key);}
    await settled();const after=await state(page);
    const events=await page.evaluate(index=>window.__journeyKeyEvents.slice(index),index);
    assert.equal(events.filter(e=>e.type==='keydown').length,keys.length,'Trusted keydown evidence');
    assert.equal(events.filter(e=>e.type==='keyup').length,keys.length,'Trusted keyup evidence');
    record('imported-walk-pulse',{target,keys,requestedMs:pulse.holdMs,before:position,after:after.player.position,events});
    stalls=distance(position,after.player.position)<.005?stalls+1:0;
    assert(stalls<3,`Keyboard movement stalled: ${JSON.stringify({target,position,keys})}`);
  }
  throw new Error(`Walking pulse budget exhausted for ${JSON.stringify(target)}`);
}
async function navigate(siteId){
  phase=`walk:${siteId}`;
  const snapshot=await state(page);
  const route=findPath(snapshot.player.position,siteId,new Set(snapshot.restoredSiteIds));report.routes.push(route);
  console.log(`route ${siteId}: ${route.rawPoints} BFS cells, ${route.points.length} waypoints, ${route.elapsedMs}ms`);
  for(const point of route.points.slice(1))await walkPoint(point);
  await page.waitForFunction(id=>document.getElementById('world').dataset.focus===id,siteId,{timeout:3000});
  route.arrived=(await state(page)).player.position;
  await press(page,'KeyE');await page.waitForFunction(id=>document.getElementById('world').dataset.inspection===id,siteId);
}
async function selectSlot(slotId){
  for(let i=0;i<30;i++){
    const before=await state(page);if(before.editor?.slotId===slotId)return;
    await press(page,'BracketRight');
    await page.waitForFunction(old=>JSON.parse(document.getElementById('world').dataset.domainState).editor?.slotId!==old,before.editor?.slotId,{timeout:2000});
  }
  throw new Error(`No selectable slot ${slotId}`);
}
async function part(slotId){const snapshot=await state(page);return snapshot.sites.find(s=>s.id===snapshot.inspectionId)?.draft.artifact.parts.find(p=>p.slotId===slotId);}
async function setting(slotId,settingId){
  await tab(page,'configure');await selectSlot(slotId);
  for(let i=0;i<20;i++){
    const before=await part(slotId);assert(before,`Missing part ${slotId}`);if(before.settingId===settingId)return;
    await press(page,'KeyF');await page.waitForFunction(({slotId,old})=>{const s=JSON.parse(document.getElementById('world').dataset.domainState);return s.sites.find(p=>p.id===s.inspectionId).draft.artifact.parts.find(p=>p.slotId===slotId).settingId!==old;},{slotId,old:before.settingId},{timeout:2000});
  }
  throw new Error(`Setting unavailable ${slotId}/${settingId}`);
}
async function rotate(slotId){
  await tab(page,'configure');await selectSlot(slotId);const before=await part(slotId);assert(before);
  await press(page,'KeyR');await page.waitForFunction(({slotId,turns})=>{const s=JSON.parse(document.getElementById('world').dataset.domainState);return s.sites.find(p=>p.id===s.inspectionId).draft.artifact.parts.find(p=>p.slotId===slotId).orientationQuarterTurns===turns;},{slotId,turns:(before.orientationQuarterTurns+1)%4});
}
const connect=(a,ap,b,bp)=>joinPorts(page,{partId:a,portId:ap},{partId:b,portId:bp});
async function repair(id){
  phase=`repair:${id}`;
  if(id==='pier_hoist'){await place(page,'rope','rope_standard');await setting('weight_b','rail_1500');await connect('rope','anchor','boom','anchor');}
  if(id==='village_pump'){await setting('outlet','outlet_3');await setting('bypass','bypass_1');}
  if(id==='tidal_sluice'){await setting('bank_baffle','bank_shield');await setting('creek_baffle','creek_open');await setting('nursery_gate','nursery_3');await setting('rack','stored');}
  if(id==='creek_bridge'){await setting('rail','tensioned');await rotate('brace_right');await connect('deck_left','join','deck_right','join');}
  if(id==='coast_windmill'){
    await place(page,'driver','driver_gear_24');await place(page,'driven','driven_gear_12');
    for(const pair of [['shaft','out','driver','in'],['driver','out','driven','in'],['driven','out','coupling','in'],['guard','cover','driver','guard']])await connect(...pair);
  }
  if(id==='woodland_pathlight'){await rotate('shield');await connect('fuse','out','regulator','in');}
  if(id==='upland_waterworks'){await setting('village_valve','village_4');await setting('habitat_valve','habitat_2');await connect('filter','out','splitter','in');}
  if(id==='ridge_beacon'){await setting('reflector','coastal_sector');await rotate('shield');}
  await press(page,'KeyT');
  await page.waitForFunction(id=>JSON.parse(document.getElementById('world').dataset.domainState).sites.find(s=>s.id===id).advice!==null,id);
  let snapshot=await state(page),site=snapshot.sites.find(s=>s.id===id);
  assert.equal(site.advice?.valid,true,`${id}: ${JSON.stringify(site.advice)} ${site.feedback}`);
  await page.waitForFunction(id=>JSON.parse(document.getElementById('world').dataset.domainState).sites.find(s=>s.id===id).testSeconds===0,id);
  await capture(`${String(report.repairs.length+1).padStart(2,'0')}-${id}-tested`);
  await click(page,'[data-key="rationale"]');
  const rationale=explanations[id],textbox=page.getByRole('textbox',{name:'Your one-line answer to the council'});
  await textbox.click();await page.keyboard.press('Control+A');await page.keyboard.type(rationale,{delay:1});
  record('typed-explanation',{siteId:id,text:rationale,input:'real keyboard typing'});
  await page.waitForFunction(({id,rationale})=>JSON.parse(document.getElementById('world').dataset.domainState).sites.find(s=>s.id===id).draft.rationale===rationale,{id,rationale});
  await click(page,'[data-key="review"]');await click(page,'[data-key="submit"]');
  await page.waitForFunction(id=>JSON.parse(document.getElementById('world').dataset.domainState).restoredSiteIds.includes(id),id,{timeout:20000});
  snapshot=await state(page);site=snapshot.sites.find(s=>s.id===id);
  report.repairs.push({id,advice:site.advice,rationale,approvedArtifact:site.approvedArtifact,restoredSiteIds:snapshot.restoredSiteIds,tick:snapshot.tick});
  console.log(`restored ${id}: ${snapshot.restoredSiteIds.length}/8`);
  if(snapshot.inspectionId)await press(page,'Escape');
  await click(page,'#save');
  // Progress exported only after the supported Save action, never imported.
  await context.storageState({path:join(out,'earned-progress.json')});
}
async function capture(name){
  const file=`${name}.png`;await page.screenshot({path:join(out,file)});const snapshot=await state(page);
  report.frames.push({file,time:new Date().toISOString(),sourceCommit:report.source.commit,runtimeCommit:report.runtimeCommit,resolution:page.viewportSize(),tick:snapshot.tick,inspectionId:snapshot.inspectionId,position:snapshot.player.position,restoredSiteIds:snapshot.restoredSiteIds});
}
try{
  model=await importedModel();report.geometry={id:model.level.id,triangles:model.level.triangles.length,obstacles:model.level.obstacles.length,stats:model.stats};
  if(process.argv.includes('--prepare-only')){
    let position=model.level.spawn;const restored=new Set();
    for(const id of Object.keys(explanations)){const route=findPath(position,id,restored);report.routes.push(route);position=route.points.at(-1);restored.add(id);console.log(`prepared ${id}: ${route.points.length} waypoints`);}
    report.result='CPU routes prepared only; no browser journey claim';
  }else{
    phase='boot';({browser,context,page,errors}=await openGame());page.setDefaultTimeout(10000);
    page.on('framenavigated',frame=>{if(frame===page.mainFrame())report.navigations.push({time:new Date().toISOString(),phase,url:frame.url()});});
    report.runtimeCommit=await page.locator('meta[name="fix-the-island-build"]').getAttribute('content');
    report.renderer=await page.locator('#world').getAttribute('data-unmasked-renderer');
    report.browserVersion=browser.version();
    assert(report.renderer&&!/swiftshader|llvmpipe/i.test(report.renderer),'Hardware renderer required');
    await page.waitForFunction(()=>document.getElementById('world').dataset.heroReady==='true');
    const liveGeometry=JSON.parse(await page.locator('#world').getAttribute('data-imported-world'));
    assert.deepEqual(normalizeGeometry(liveGeometry),normalizeGeometry(model.stats),'CPU stylized geometry must match visible runtime diagnostics (1e-8 numeric tolerance)');
    if(process.argv.includes('--strict-commit'))assert.equal(report.runtimeCommit,report.source.commit,'Preview build metadata must match source commit');
    await click(page,'#start-practice');assert.deepEqual((await state(page)).restoredSiteIds,[]);
    await capture('00-fresh-landing');
    for(const id of Object.keys(explanations)){await navigate(id);await repair(id);}
    phase='ending';await page.waitForFunction(()=>document.getElementById('world').dataset.ending==='true');
    const completed=await state(page);assert.equal(completed.mode,'practice');assert.equal(completed.restoredSiteIds.length,8);
    await capture('09-local-ending');await click(page,'#save');
    await context.storageState({path:join(out,'earned-ending.json')});
    phase='save-continue';await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>document.getElementById('world')?.dataset.heroReady==='true');
    await page.waitForFunction(()=>{const button=document.querySelector('#continue');return button instanceof HTMLButtonElement&&!button.disabled;});
    await click(page,'#continue');
    await page.waitForFunction(()=>document.getElementById('world').dataset.ending==='true');
    const resumed=await state(page);assert.deepEqual(resumed.restoredSiteIds,completed.restoredSiteIds);
    assert.deepEqual(resumed.sites.map(s=>s.approvedArtifact),completed.sites.map(s=>s.approvedArtifact));
    assert.deepEqual(resumed.sites.map(s=>s.draft.rationale),completed.sites.map(s=>s.draft.rationale));
    assert.equal(resumed.mode,'practice');await capture('10-ending-after-continue');
    report.checks.push('All eight repairs completed through real inputs','All eight approved artifacts and typed explanations survive Save / reload / Continue','Finale visible before and after reload');
    report.sourceEnd=await provenance();
    assert.equal(report.sourceEnd.runtimeSourceSha256,report.source.runtimeSourceSha256,'Runtime source changed during journey; rerun after primary snapshot is stable');
    assert.deepEqual(errors,[]);report.complete=true;report.result='All-eight actual-input journey completed';
  }
}catch(error){
  report.result='Journey check failed';report.failure={phase,message:String(error.stack??error)};process.exitCode=1;
  if(page){try{report.failureState=await state(page);await capture('failure');}catch(captureError){report.captureFailure=String(captureError);}}
}finally{
  report.finished=new Date().toISOString();report.errors=errors;report.actions=actions;
  report.sourceEnd??=await provenance();
  report.sourceChanged=report.sourceEnd.runtimeSourceSha256!==report.source.runtimeSourceSha256;
  report.changedRuntimeFiles=[...new Set([...Object.keys(report.source.files),...Object.keys(report.sourceEnd.files)])].filter(file=>report.source.files[file]!==report.sourceEnd.files[file]);
  if(report.failure&&report.sourceChanged)report.failure.concurrentSourceChange='Source changed during this run; a preview reload can interrupt input. This run is not stable-snapshot evidence. See changedRuntimeFiles and navigations.';
  if(page){try{report.trustedKeyEvents=await page.evaluate(()=>window.__journeyKeyEvents);}catch{}}
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  await writeFile(join(out,'MANIFEST.md'),`# Imported island journey\n\n${report.result}\n\nSource commit: ${report.source.commit}\n\nRuntime meta commit: ${report.runtimeCommit??'n/a'}\n\nRuntime source SHA-256: ${report.source.runtimeSourceSha256}\n\nRenderer: ${report.renderer??'n/a'}\n\n${report.frames.map(f=>`- ${f.file}: ${f.resolution.width}x${f.resolution.height}, tick ${f.tick}, ${f.time}, ${f.restoredSiteIds.length}/8 restored`).join('\n')}\n`);
  await context?.close();await browser?.close();
  console.log(JSON.stringify({out,result:report.result,complete:report.complete,repairs:report.repairs.length,frames:report.frames.length,errors,failure:report.failure},null,2));
}
