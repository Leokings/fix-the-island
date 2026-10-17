import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {openGame,state,click,press,place,setting,join as joinPorts,actions,record} from './browser-play.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),out=join(root,'artifacts/landing-refinement',new Date().toISOString().replaceAll(':','-').replaceAll('.','-'));
await mkdir(out,{recursive:true});
const source=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const dirty=execFileSync('git',['status','--porcelain','--','src','tests','tools/landing-refinement.mjs'],{cwd:root,encoding:'utf8'}).trim();
const {browser,context,page,errors}=await openGame({width:1920,height:1080},{touch:true});
const observations=[],frames=[];let complete=false,failure=null,runtime=null;
async function frame(name){await page.screenshot({path:join(out,`${name}.png`)});const snapshot=await state(page);frames.push({name,time:new Date().toISOString(),tick:snapshot.tick,position:snapshot.player.position,restored:snapshot.restoredSiteIds,landing:JSON.parse(await page.locator('#world').getAttribute('data-landing-restoration')),objective:await page.locator('.island-quests summary').textContent()});}
async function checkpoint(name){await click(page,'#save');await context.storageState({path:join(out,`${name}-earned-storage.json`)});record('earned-checkpoint',{name,source,runtime,tick:(await state(page)).tick,origin:'actual input -> supported Save -> unchanged storageState export'});}
try{
  runtime=await page.locator('meta[name="fix-the-island-build"]').getAttribute('content');
  if(process.argv.includes('--strict-commit')){assert.equal(dirty,'','Owned runtime source must be checkpointed');assert.equal(runtime,source);}
  await page.waitForFunction(()=>document.getElementById('world').dataset.heroReady==='true');
  assert.equal(JSON.parse(await page.locator('#world').getAttribute('data-audio')).state,'not-created','No autoplay');
  await click(page,'#start-practice');await page.waitForTimeout(400);await frame('01-landing-objective');
  assert.match(await page.locator('.island-quests summary').textContent(),/Landing Hoist/);
  await click(page,'#mute');await page.waitForFunction(()=>JSON.parse(document.getElementById('world').dataset.audio).enabled);observations.push({sound:'explicit button gesture',audio:JSON.parse(await page.locator('#world').getAttribute('data-audio'))});
  await press(page,'KeyE');assert.equal((await state(page)).inspectionId,'pier_hoist');
  assert.match(await page.locator('.rp-guidance').textContent(),/Balance the cargo/);
  await press(page,'KeyT');await page.waitForFunction(()=>JSON.parse(document.getElementById('world').dataset.domainState).sites[0].advice!==null);let snapshot=await state(page);assert.equal(snapshot.sites[0].advice.valid,false);observations.push({initialTest:snapshot.sites[0].advice});
  await page.waitForFunction(()=>JSON.parse(document.getElementById('world').dataset.domainState).sites[0].testSeconds===0);
  assert.match(await page.locator('.rp-guidance').textContent(),/link is missing/);
  await click(page,'[data-key=feedback]');assert.match(await page.locator('.rp-test-result').textContent(),/needs a change/);await frame('02-test-feedback');await click(page,'[data-key=back]');
  await setting(page,'weight_b','rail_1000');await page.setViewportSize({width:667,height:375});await page.waitForTimeout(350);
  const near=await page.locator('[data-key=setting-rail_1000]').boundingBox(),far=await page.locator('[data-key=setting-rail_1500]').boundingBox(),toolbar=await page.locator('.rp-actions').boundingBox();
  assert(near&&far&&toolbar);assert(near.height>=44&&far.height>=44);assert(far.x+far.width<=toolbar.x,'Far control must not be clipped behind Test/Explain');
  for(const [id,bounds]of [['rail_1000',near],['rail_1500',far]])assert(await page.evaluate(({id,bounds})=>document.elementFromPoint(bounds.x+bounds.width/2,bounds.y+bounds.height/2)?.closest(`[data-key="setting-${id}"]`)!==null,{id,bounds}),'Both setting controls have actual exposed hit targets');
  await click(page,'[data-key=setting-rail_1500]','Phone Far counterweight setting');await page.waitForFunction(()=>JSON.parse(document.getElementById('world').dataset.domainState).sites[0].draft.artifact.parts.find(p=>p.slotId==='weight_b').settingId==='rail_1500');await frame('02b-phone-far-weight-preview');
  await click(page,'[data-key=setting-rail_1000]','Phone Near counterweight setting');await page.waitForFunction(()=>JSON.parse(document.getElementById('world').dataset.domainState).sites[0].draft.artifact.parts.find(p=>p.slotId==='weight_b').settingId==='rail_1000');observations.push({phoneSettings:{near,far,toolbar,actualClicks:true}});
  await page.setViewportSize({width:1920,height:1080});await page.waitForTimeout(250);const weightHelp=await page.locator('.rp-weight-help').boundingBox(),learningBox=await page.locator('.rp-learning').boundingBox();assert(weightHelp&&learningBox&&weightHelp.y+weightHelp.height<=learningBox.y+learningBox.height,'Default desktop weight help must fit');
  await place(page,'rope','rope_standard');
  await setting(page,'weight_b','rail_1500');
  await joinPorts(page,{partId:'rope',portId:'anchor'},{partId:'boom',portId:'anchor'});
  await press(page,'KeyT');await page.waitForFunction(()=>JSON.parse(document.getElementById('world').dataset.domainState).sites[0].advice!==null);snapshot=await state(page);assert.equal(snapshot.sites[0].advice.valid,true,snapshot.sites[0].feedback);observations.push({finalTest:snapshot.sites[0].advice});
  await page.waitForFunction(()=>JSON.parse(document.getElementById('world').dataset.domainState).sites[0].testSeconds===0);
  assert.match(await page.locator('.rp-guidance').textContent(),/Test passed/);await frame('03-constructed-test-passed');
  await click(page,'[data-key=rationale]');const rationale='I fitted and anchored the rope, then moved a counterweight to balance the cargo. I kept the pulley guard and shore access clear, and would inspect the rope before each lift to protect workers and shoreline nests.';
  record('text-input',{target:'Your repair rationale',text:rationale});await page.getByRole('textbox',{name:'Your repair rationale'}).fill(rationale);
  await click(page,'[data-key=review]');await click(page,'[data-key=submit]');
  await page.waitForFunction(()=>JSON.parse(document.getElementById('world').dataset.domainState).sites[0].phase==='restoring');
  await page.waitForTimeout(850);await frame('04-crew-installing-cargo');
  assert.equal((await state(page)).restoredSiteIds.length,0,'Installation is not yet complete');
  await page.waitForFunction(()=>JSON.parse(document.getElementById('world').dataset.domainState).restoredSiteIds.includes('pier_hoist'));
  await page.waitForTimeout(350);await frame('05-working-landing-next-objective');
  assert.match(await page.locator('.island-quests summary').textContent(),/Spring Pump/);assert.match(await page.locator('.objective-marker').textContent(),/Spring Pump/);
  snapshot=await state(page);assert.equal(snapshot.mode,'practice');assert.deepEqual(snapshot.restoredSiteIds,['pier_hoist']);assert.equal(JSON.parse(await page.locator('#world').getAttribute('data-landing-restoration')).lift,1);
  const completed=snapshot.sites[0].approvedArtifact;await checkpoint('landing-completed');
  await page.reload({waitUntil:'networkidle'});await click(page,'#continue');await page.waitForTimeout(400);snapshot=await state(page);
  assert.deepEqual(snapshot.sites[0].approvedArtifact,completed);assert.deepEqual(snapshot.restoredSiteIds,['pier_hoist']);assert.match(await page.locator('.island-quests summary').textContent(),/Spring Pump/);
  assert.equal(JSON.parse(await page.locator('#world').getAttribute('data-audio')).state,'not-created','Reload does not autoplay');await frame('06-reloaded-local-progress');
  await page.setViewportSize({width:667,height:375});await page.waitForTimeout(450);
  const cdp=await context.newCDPSession(page),stick=await page.locator('#joystick').boundingBox();assert(stick);const x=stick.x+stick.width/2,y=stick.y+stick.height/2,before=(await state(page)).player.position;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+20,y:y+12}]});await new Promise(resolve=>setTimeout(resolve,300));await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(300);snapshot=await state(page);
  assert(Math.hypot(snapshot.player.position.x-before.x,snapshot.player.position.z-before.z)>.05);assert(Math.hypot(snapshot.player.velocity.x,snapshot.player.velocity.z)<.02);observations.push({touchBefore:before,touchAfter:snapshot.player.position});
  await frame('07-next-objective-667');assert.deepEqual(errors,[]);complete=true;
}catch(error){failure=String(error.stack??error);try{await frame('failure');await checkpoint('failure');}catch{}process.exitCode=1;}
finally{
  const report={scope:'Fresh actual-input first local repair only: failed test, physical rope placement, manual weight adjustment/linking, passed test, rationale/review/completion, crew/cargo feedback, supported save/reload, next objective and landscape touch. No live review/signing or eight-site ending claim.',complete,source,runtime,dirty:!!dirty,observations,frames,actions,errors,failure,renderer:await page.locator('#world').getAttribute('data-unmasked-renderer')};
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({out,complete,source,runtime,errors,failure}));await context.close();await browser.close();
}
