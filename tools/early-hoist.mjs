import {mkdir,writeFile}from'node:fs/promises';
import {execFileSync}from'node:child_process';
import {join}from'node:path';
import {fileURLToPath}from'node:url';
import assert from'node:assert/strict';
import {openGame,state,click,walkTo,inspect,place,setting,join as joinPorts,confirmPractice,actions}from'./browser-play.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),out=join(root,'artifacts/stage-b/early-hoist');await mkdir(out,{recursive:true});
const report={scope:'Stage B early hoist input checkpoint; not the eight-site journey',commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),time:new Date().toISOString()};
const {browser,context,page,errors}=await openGame();
try {
  report.renderer=await page.locator('#world').getAttribute('data-unmasked-renderer');
  await page.screenshot({path:join(out,'01-start.png')});await click(page,'#start-practice');
  await walkTo(page,{x:-38,z:42.8});await inspect(page,'pier_hoist');
  await place(page,'rope','rope_standard');await setting(page,'weight_b','rail_1500');
  await joinPorts(page,{partId:'rope',portId:'anchor'},{partId:'boom',portId:'anchor'});
  await page.screenshot({path:join(out,'02-construction.png')});
  await confirmPractice(page,'The 3-unit weight at one metre and 2-unit weight at one and a half metres balance the six-unit load. I anchor the rope and retain the pulley guard, protect shoreline nests, and leave access clear for rope inspection and safe maintenance.');
  const repaired=await state(page);assert.equal(repaired.restoredSiteIds.length,1);report.restoredSiteIds=repaired.restoredSiteIds;
  await page.screenshot({path:join(out,'03-restored.png')});await walkTo(page,{x:-34,z:44});
  await page.screenshot({path:join(out,'04-walking-after-repair.png')});report.position=(await state(page)).player.position;
  report.shadowMapReady=await page.locator('#world').getAttribute('data-shadow-ready');report.shaderProgramsLinked=await page.locator('#world').getAttribute('data-programs-linked');
  assert.deepEqual(errors,[]);report.result='input checks completed';
}catch(error){report.result='input check error';report.failure=error.stack;process.exitCode=1;}finally{report.errors=errors;report.actions=actions;await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await context.close();await browser.close();console.log(JSON.stringify(report,null,2));}
