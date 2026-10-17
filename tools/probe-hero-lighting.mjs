import {mkdir,writeFile,readFile} from 'node:fs/promises';import {join} from 'node:path';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {openGame,click,press,state,actions,record} from './browser-play.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),out=join(root,'artifacts/stage-c/C1/hero-light-probe',new Date().toISOString().replaceAll(':','-').replaceAll('.','-'));await mkdir(out,{recursive:true});
const facing=process.argv.find(a=>a.startsWith('--facing='))?.slice(9)??'KeyS',probes=(process.argv.find(a=>a.startsWith('--probes='))?.slice(9)??'normal,ao-off,shadows-off,bind,arms-bind,no-contact,albedo').split(',');
assert(['KeyS','KeyA','KeyD','KeyW'].includes(facing));
const origin=join(root,'artifacts/stage-b/reuse-journey/2026-10-08T17-38-53-798Z'),source=JSON.parse(await readFile(join(origin,'journey-report.json'),'utf8')),e=source.earnedSaves.find(e=>e.file==='earned-pier_hoist.json'),storage=join(origin,e.file);
assert.equal(createHash('sha256').update(await readFile(storage)).digest('hex'),e.sha256);
const report={scope:'Development renderer isolation, not delivered-commit gate images. Same earned saved state, actual Continue/fixed key pulse/release/settled pause; original GLB unchanged. Bind/arms/contact/albedo probes affect rendering only.',facing,save:e,probes:[]};
for(const probe of probes){
  const {browser,context,page,errors}=await openGame({width:1920,height:1080},{storageState:storage,query:probe==='normal'?'':`?render-probe=${probe}`});
  try{await page.waitForFunction(()=>document.getElementById('world')?.dataset.heroReady==='true');await click(page,'#continue');record('key-down',{key:facing,probe});await page.keyboard.down(facing);await new Promise(resolve=>setTimeout(resolve,240));await page.keyboard.up(facing);record('key-up',{key:facing,probe});await page.waitForFunction(()=>{const s=JSON.parse(document.getElementById('world').dataset.domainState);return Math.hypot(s.player.velocity.x,s.player.velocity.z)<.001;});await page.waitForTimeout(900);await press(page,'Escape');await press(page,'KeyM');
    const s=await state(page),m=JSON.parse(await page.locator('#world').getAttribute('data-composition'));await page.screenshot({path:join(out,`${probe}.png`)});
    const b=m.hero;await page.screenshot({path:join(out,`${probe}-hero-native-crop.png`),clip:{x:Math.floor(b.x)-8,y:Math.floor(b.y)-8,width:Math.ceil(b.width)+16,height:Math.ceil(b.height)+16}});
    // Component-wise braking leaves the larger velocity component moving last.
    // Compare observed settled headings, not a guessed movement angle.
    report.probes.push({probe,position:s.player.position,heading:s.player.heading,gaitPhase:s.player.gaitPhase,pose:JSON.parse(await page.locator('#world').getAttribute('data-hero-rig')),errors,camera:m.camera});
    await writeFile(join(out,'report.json'),JSON.stringify({...report,actions},null,2)+'\n');
    assert(Math.abs(s.player.heading-report.probes[0].heading)<1e-6,`Every probe must have the same observed heading: ${s.player.heading}`);assert.deepEqual(errors,[]);console.log(`same-heading probe ${probe}: ${s.player.heading}`);
  }finally{await context.close();await browser.close();}
}
report.actions=actions;await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(out);
