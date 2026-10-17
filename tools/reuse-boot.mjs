import{mkdir,readFile,writeFile}from'node:fs/promises';import{join}from'node:path';import{fileURLToPath}from'node:url';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';import assert from'node:assert/strict';
import{openGame,state,click,press,actions,record}from'./browser-play.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),stamp=new Date().toISOString(),out=join(root,'artifacts/stage-b/reuse',stamp.replaceAll(':','-').replaceAll('.','-'));await mkdir(out,{recursive:true});
const report={scope:'Current foundation native hardware-Chrome boot, articulated walking and real pier inspection. No seeded progress, signing or art verdict.',started:stamp,commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),workingTree:execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),captures:[],rigSamples:[]};
const{browser,context,page,errors}=await openGame();
const shot=async(name)=>{const snapshot=await state(page),file=`${name}.png`;await page.screenshot({path:join(out,file)});report.captures.push({file,viewport:page.viewportSize(),timestamp:new Date().toISOString(),position:snapshot.player.position,tick:snapshot.tick,restoredSiteIds:snapshot.restoredSiteIds,sha256:createHash('sha256').update(await readFile(join(out,file))).digest('hex')});};
try{
  await page.waitForFunction(()=>document.getElementById('world')?.dataset.heroReady==='true'&&document.getElementById('world')?.dataset.windmillReady==='true');
  report.runtimeCommit=await page.locator('meta[name="fix-the-island-build"]').getAttribute('content');report.renderer=await page.locator('#world').getAttribute('data-unmasked-renderer');
  if(process.argv.includes('--strict-commit'))assert.equal(report.runtimeCommit,report.commit);
  assert.equal(await page.locator('#world').getAttribute('data-nature-ready'),'true');
  report.nature=JSON.parse(await page.locator('#world').getAttribute('data-nature-stats'));
  report.plantedTreeColliders=Number(await page.locator('#world').getAttribute('data-planted-tree-colliders'));
  assert.equal(report.plantedTreeColliders,report.nature.plantedTrees);
  const beforeFrames=Number(await page.locator('#world').getAttribute('data-frames')),startTime=performance.now();await page.waitForTimeout(2000);
  const frameCount=Number(await page.locator('#world').getAttribute('data-frames'))-beforeFrames,seconds=(performance.now()-startTime)/1000;
  report.frameObservation={scope:'Two-second title-window observation on this hardware/run only; not a journey average or device guarantee',frames:frameCount,seconds,fps:frameCount/seconds};
  await click(page,'#start-practice');report.initialState=await state(page);await shot('1920-idle');
  record('key-down',{key:'KeyW'});await page.keyboard.down('KeyW');
  for(let i=0;i<3;i++){await page.waitForTimeout(200);report.rigSamples.push({snapshot:await state(page),rig:JSON.parse(await page.locator('#world').getAttribute('data-hero-rig'))});await shot(`1920-walk-${i}`);}
  await page.keyboard.up('KeyW');record('key-up',{key:'KeyW'});await page.waitForTimeout(350);
  const walking=await state(page);report.walkedMetres=Math.hypot(walking.player.position.x-report.initialState.player.position.x,walking.player.position.z-report.initialState.player.position.z);assert(report.walkedMetres>.5);
  assert(report.rigSamples.every(s=>s.rig.skinned&&s.rig.joints>=22));assert.notDeepEqual(report.rigSamples[0].rig.leftLeg,report.rigSamples[2].rig.leftLeg);
  await press(page,'KeyE');assert.equal((await state(page)).inspectionId,'pier_hoist');await shot('1920-inspect');
  await page.setViewportSize({width:667,height:375});record('viewport',{width:667,height:375});await page.waitForTimeout(600);await shot('667-inspect');
  await press(page,'Escape');await page.waitForTimeout(400);await shot('667-walk-world');
  await page.setViewportSize({width:1920,height:1080});record('viewport',{width:1920,height:1080});await page.waitForTimeout(500);
  await press(page,'Escape');assert.equal((await state(page)).paused,true);await page.waitForTimeout(100);
  const paused=await page.locator('#world').getAttribute('data-domain-state');await shot('1920-warm-paused');
  await click(page,'#style-toggle');await page.waitForTimeout(200);await shot('1920-cool-paused');
  assert.equal(await page.locator('#world').getAttribute('data-domain-state'),paused);
  await click(page,'#style-toggle');await page.waitForTimeout(200);assert.equal(await page.locator('#world').getAttribute('data-domain-state'),paused);
  report.rendererSwap={pausedDomainExactlyUnchanged:true,styles:['warm-smoke','cool-smoke','warm-smoke'],materialsAndKeyLight:true};
  await press(page,'Escape');
  assert.equal(await page.locator('#world').getAttribute('data-shadow-ready'),'true');assert.equal(await page.locator('#world').getAttribute('data-programs-linked'),'true');assert.deepEqual(errors,[]);
  report.finalState=await state(page);report.result='boot/walk/pier-inspection checks completed';
}catch(error){await page.keyboard.up('KeyW');report.result='check error';report.failure=error.stack;await shot('failure');process.exitCode=1;}finally{report.errors=errors;report.actions=actions;report.finished=new Date().toISOString();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await context.close();await browser.close();console.log(JSON.stringify({path:out,result:report.result,walkedMetres:report.walkedMetres,failure:report.failure,errors},null,2));}
