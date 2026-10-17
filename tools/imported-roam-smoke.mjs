import {mkdir,writeFile}from'node:fs/promises';import{join}from'node:path';import{fileURLToPath}from'node:url';import assert from'node:assert/strict';
import{openGame,state,click,press,selectSocket,place}from'./browser-play.mjs';
import{execFileSync}from'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url)),out=join(root,'artifacts/imported-world',new Date().toISOString().replaceAll(':','-').replaceAll('.','-'));await mkdir(out,{recursive:true});
const{browser,context,page,errors}=await openGame({width:1920,height:1080},{touch:true});const observations=[];
try{
  await page.waitForFunction(()=>document.getElementById('world')?.dataset.heroReady==='true');
  await page.screenshot({path:join(out,'island-menu-1920.png')});
  await click(page,'#start-practice');await page.waitForTimeout(500);
  await press(page,'KeyE');assert.equal((await state(page)).inspectionId,'pier_hoist');await selectSocket(page,'rope');await place(page,'rope','rope_standard');await page.screenshot({path:join(out,'island-inspect-1920.png')});await click(page,'[data-key=exit]');
  for(const[keys,ms]of [[['KeyD'],900],[['KeyW'],900],[['KeyA'],900],[['KeyS'],900],[['KeyD','KeyW','ShiftLeft'],650],[['KeyA','KeyS'],650]]){
    const before=await state(page);for(const key of keys)await page.keyboard.down(key);await new Promise(r=>setTimeout(r,ms));
    const clip=JSON.parse(await page.locator('#world').getAttribute('data-hero-rig'));
    for(const key of keys)await page.keyboard.up(key);await page.waitForTimeout(450);const after=await state(page);
    observations.push({keys,requestedMs:ms,before:before.player.position,after:after.player.position,distance:Math.hypot(after.player.position.x-before.player.position.x,after.player.position.z-before.player.position.z),animation:clip.animation});
  }
  // A longer, unscripted-direction coast excursion, not PUBLIC_ROUTES or a
  // teleport. A physical rock/water stop is recorded rather than bypassed.
  for(const keys of [['KeyW'],['KeyS']]){const before=await state(page);for(const key of keys)await page.keyboard.down(key);await new Promise(r=>setTimeout(r,3000));for(const key of keys)await page.keyboard.up(key);await page.waitForTimeout(400);const after=await state(page);observations.push({keys,requestedMs:3000,before:before.player.position,after:after.player.position,distance:Math.hypot(after.player.position.x-before.player.position.x,after.player.position.z-before.player.position.z)});}
  await page.screenshot({path:join(out,'island-roam-1920.png')});
  const snapshot=await state(page);assert.equal(snapshot.sites.length,8);assert.equal(snapshot.restoredSiteIds.length,0);
  assert(observations.some(p=>p.animation==='Walking'));assert(observations.some(p=>p.animation==='Running'));assert(observations.filter(p=>p.distance>1).length>=4);
  await click(page,'#save');const retained=(await state(page)).sites[0].draft;await page.reload({waitUntil:'networkidle'});await click(page,'#continue');assert.deepEqual((await state(page)).sites[0].draft,retained);
  await page.setViewportSize({width:667,height:375});await page.waitForTimeout(500);
  const cdp=await context.newCDPSession(page),j=await page.locator('#joystick').boundingBox();assert(j);const beforeTouch=(await state(page)).player.position,x=j.x+j.width/2,y=j.y+j.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+25,y:y+8}]});await new Promise(r=>setTimeout(r,400));await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(400);
  const afterTouch=await state(page);assert(Math.hypot(afterTouch.player.position.x-beforeTouch.x,afterTouch.player.position.z-beforeTouch.z)>.1);assert(Math.hypot(afterTouch.player.velocity.x,afterTouch.player.velocity.z)<.02);
  await page.screenshot({path:join(out,'island-roam-667.png')});
  const source=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),runtime=await page.locator('meta[name="fix-the-island-build"]').getAttribute('content');assert.equal(runtime,source);
  const report={scope:'Fresh local-practice WASD/diagonal/Shift and touch roaming, physical hoist placement, save/Continue on imported visible island; no repair completion or signing; not a full eight-repair replay.',source,runtime,world:JSON.parse(await page.locator('#world').getAttribute('data-imported-world')),renderer:await page.locator('#world').getAttribute('data-unmasked-renderer'),observations,touch:{before:beforeTouch,after:afterTouch.player.position},errors};
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');assert.deepEqual(errors,[]);console.log(JSON.stringify({out,observations,errors}));
}finally{await context.close();await browser.close();}
