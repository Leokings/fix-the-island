import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {openGame,state,click,press,actions} from './browser-play.mjs';

const out=resolve(process.argv[2]??'artifacts/visual-polish/current');await mkdir(out,{recursive:true});
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const report={source,scope:'Focused keyboard/touch smoke, plus unchanged earned-ending Continue replay; not a new eight-repair journey or live chain verification.',frames:[],checks:[],errors:[],complete:false};
let game;
async function capture(page,name){
  const runtime=await page.locator('meta[name="fix-the-island-build"]').getAttribute('content');assert.equal(runtime,source);
  const snapshot=await state(page),file=`${name}-${page.viewportSize().width}.png`;
  await page.screenshot({path:join(out,file)});report.frames.push({file,runtime,viewport:page.viewportSize(),position:snapshot.player.position,restored:snapshot.restoredSiteIds,cutawayComponents:await page.locator('#world').getAttribute('data-cutaway-components'),time:new Date().toISOString()});
}
async function close(){if(game){report.errors.push(...game.errors);await game.context.close();await game.browser.close();game=null;}}
try{
  game=await openGame({width:1920,height:1080},{touch:true});let {page,context}=game;
  await click(page,'#start-practice');const before=await state(page);
  try{await page.keyboard.down('KeyW');await new Promise(r=>setTimeout(r,320));}finally{await page.keyboard.up('KeyW');}
  await page.waitForTimeout(450);const after=await state(page);
  const moved=Math.hypot(after.player.position.x-before.player.position.x,after.player.position.z-before.player.position.z);assert(moved>.25);assert(Math.hypot(after.player.velocity.x,after.player.velocity.z)<.02);
  report.checks.push({input:'actual keyboard W + release',moved,before:before.player.position,after:after.player.position,renderer:await page.locator('#world').getAttribute('data-unmasked-renderer')});
  await capture(page,'landing-roam');await press(page,'KeyE');assert.equal((await state(page)).inspectionId,'pier_hoist');await capture(page,'landing-repair');
  await press(page,'Escape');assert.equal((await state(page)).inspectionId,null);
  await page.setViewportSize({width:667,height:375});await page.waitForTimeout(300);
  const j=await page.locator('#joystick').boundingBox();assert(j);const cdp=await context.newCDPSession(page),x=j.x+j.width/2,y=j.y+j.height/2;
  const phoneBefore=await state(page);
  try{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+20,y:y+5}]});await new Promise(r=>setTimeout(r,240));}finally{await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  await page.waitForTimeout(450);const phoneAfter=await state(page);assert(Math.hypot(phoneAfter.player.position.x-phoneBefore.player.position.x,phoneAfter.player.position.z-phoneBefore.player.position.z)>.1);assert(Math.hypot(phoneAfter.player.velocity.x,phoneAfter.player.velocity.z)<.02);
  report.checks.push({input:'667 landscape actual touch joystick + release',before:phoneBefore.player.position,after:phoneAfter.player.position});await capture(page,'landing-touch');
  await page.locator('#interact').tap();await page.waitForTimeout(180);assert.equal((await state(page)).inspectionId,'pier_hoist');await capture(page,'landing-touch-repair');await close();
  const earned=resolve('artifacts/clarity-journey/2026-10-08T20-33-29-996Z/earned-ending.json'),bytes=await readFile(earned),sha=createHash('sha256').update(bytes).digest('hex');
  report.earnedSave={path:earned,sha256:sha,originCommit:'b4d6f2ea6dc5ec47c9ca91501ab34ba53d6dc31a',originRun:'2026-10-08T20-33-29-996Z',method:'Unedited actual eight-repair journey storageState, supported Continue'};
  game=await openGame({width:1920,height:1080},{touch:true,storageState:earned});({page}=game);await click(page,'#continue');
  assert.equal((await state(page)).restoredSiteIds.length,8);assert((await state(page)).ending);assert.equal(await page.locator('#diagnosis').textContent(),'All eight repairs complete. Explore freely or replay.');
  await capture(page,'earned-ending');await page.setViewportSize({width:667,height:375});await page.waitForTimeout(300);await capture(page,'earned-ending-mobile');
  assert.equal(createHash('sha256').update(await readFile(earned)).digest('hex'),sha);await close();assert.deepEqual(report.errors,[]);report.complete=true;
}catch(error){report.failure=error.stack??String(error);process.exitCode=1;if(game)await game.page.screenshot({path:join(out,'failure.png')}).catch(()=>{});}
finally{await close();report.actions=actions;await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({out,source,complete:report.complete,errors:report.errors,failure:report.failure}));}
