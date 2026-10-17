import { mkdir,writeFile } from 'node:fs/promises';
import { join } from 'node:path';import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';import assert from 'node:assert/strict';
import { openGame,click,press,state,selectSocket,place,tab,actions } from './browser-play.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),out=join(root,'artifacts/visible-update',new Date().toISOString().replaceAll(':','-').replaceAll('.','-'));await mkdir(out,{recursive:true});
const {browser,context,page,errors}=await openGame({width:1920,height:1080},{touch:true}),report={scope:'Focused visible update: fresh local keyboard/touch UI smoke, not a new full journey or art verdict.',source:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),checks:[],errors};
try {
  await page.waitForFunction(()=>document.getElementById('world')?.dataset.heroReady==='true');await page.evaluate(()=>document.fonts.ready);
  assert(await page.evaluate(()=>document.body.classList.contains('production-ui')&&document.fonts.check('800 16px Nunito')));
  assert.equal(await page.locator('#style-toggle').isVisible(),false);assert((await page.locator('.expedition-menu').innerText()).includes('No wallet or independent review'));
  report.props=JSON.parse(await page.locator('#world').getAttribute('data-repair-props'));assert(report.props.placed>0);
  await click(page,'#start-practice');const initial=await state(page);assert.equal(initial.sites.length,8,'The playable world must expose all eight repair sites');const before=initial.player.position;
  await page.keyboard.down('KeyW');await new Promise(resolve=>setTimeout(resolve,350));await page.keyboard.up('KeyW');await page.waitForTimeout(400);
  const after=(await state(page)).player.position;assert(Math.hypot(after.x-before.x,after.z-before.z)>.2);await press(page,'KeyE');assert.equal((await state(page)).inspectionId,'pier_hoist');
  await place(page,'rope','rope_standard');await tab(page,'configure');assert.equal((await state(page)).editor.tab,'configure');
  await tab(page,'connect');assert.equal((await state(page)).editor.tab,'connect');await click(page,'[data-key=feedback]');assert(await page.locator('.production-hint').first().isVisible());await click(page,'[data-key=back]');await click(page,'[data-key=exit]');
  report.checks.push('Nunito/style/mode loaded; actual keyboard movement/inspection and pointer physical placement; Adjust/Connect/Details/Back/Exit');
  await page.setViewportSize({width:667,height:375});await page.waitForTimeout(250);const cdp=await context.newCDPSession(page);
  const touch=async(selector)=>{const b=await page.locator(selector).boundingBox();assert(b,selector);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(80);};
  const j=await page.locator('#joystick').boundingBox();assert(j);const mobileInitial=(await state(page)).player.position,x=j.x+j.width/2,y=j.y+j.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-12,y:y-25}]});await new Promise(resolve=>setTimeout(resolve,250));await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(400);
  const moved=(await state(page)).player.position;assert(Math.hypot(moved.x-mobileInitial.x,moved.z-mobileInitial.z)>.1);assert(Math.hypot((await state(page)).player.velocity.x,(await state(page)).player.velocity.z)<.02);
  await touch('#interact');assert.equal((await state(page)).inspectionId,'pier_hoist');await touch('[data-key="pb-part-rope"]');await touch('[data-key="pb-step-set"]');await touch('[data-key="pb-step-connect"]');await touch('[data-key="pb-step-place"]');await touch('[data-key=rationale]');
  await page.getByRole('textbox',{name:'Your repair rationale'}).fill('I will balance the lift, protect the pulley, and keep maintenance access away from shoreline nests.');await touch('[data-key=back]');await touch('[data-key=exit]');
  report.checks.push('667×375 real Chrome TOUCH joystick/movement/release, Interact/socket/three tabs/rationale/Back/Exit; not a physical-phone claim');
  await page.setViewportSize({width:1920,height:1080});await page.waitForTimeout(400);await press(page,'KeyE');await page.waitForTimeout(500);
  await page.screenshot({path:join(out,'preview-1920.png')});report.runtime=await page.locator('meta[name="fix-the-island-build"]').getAttribute('content');report.renderer=await page.locator('#world').getAttribute('data-unmasked-renderer');assert.deepEqual(errors,[]);report.result='focused smoke completed';
}catch(error){report.result='focused smoke failed';report.failure=error.stack;process.exitCode=1;await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});}finally{report.actions=actions;await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await context.close();await browser.close();console.log(JSON.stringify({path:out,result:report.result,props:report.props,errors,failure:report.failure},null,2));}
