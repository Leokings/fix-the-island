import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import {join} from 'node:path';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {openGame,state,click,press,walkTo,inspect,actions,record} from './browser-play.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),stamp=new Date().toISOString(),out=join(root,'artifacts/stage-c/C1',stamp.replaceAll(':','-').replaceAll('.','-'));
const origin='artifacts/stage-b/reuse-journey/2026-10-08T17-38-53-798Z',earned=JSON.parse(await readFile(join(root,origin,'journey-report.json'),'utf8'));
assert.equal(earned.result,'journey input checks completed');assert.equal(earned.commit,'731c0cd80e713b58d3daaba79491e1306e0f4a1c');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');await mkdir(out,{recursive:true});
const report={scope:'C1 lighting/post art-only Continue captures from unchanged genuinely earned 731 storage; not a new fresh B journey, not a visual verdict.',started:stamp,renderCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),workingTree:execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),stills:[],regression:[],errors:[]};
const cases=[['01','pier_hoist',[-40,42.8],false],['06','pier_hoist',[-39.2,42.8],false],['02','coast_windmill',[40,-11.2],true],['03','creek_bridge',[1,.45],false],['04','tidal_sluice',[30,40.2],false],['05','upland_waterworks',[-26,-31.8],true]];
const shot=async(page,file)=>{await page.screenshot({path:join(out,file)});return digest(await readFile(join(out,file)));};
try {
  for(const [ref,site,[x,z],open] of cases){
    const evidence=earned.earnedSaves.find(e=>e.file===`earned-${site}.json`);assert(evidence);const storagePath=join(root,origin,evidence.file);assert.equal(digest(await readFile(storagePath)),evidence.sha256);
    const {browser,context,page,errors}=await openGame({width:1920,height:1080},{storageState:storagePath});
    try {
      const runtimeCommit=await page.locator('meta[name="fix-the-island-build"]').getAttribute('content');if(process.argv.includes('--strict-commit'))assert.equal(runtimeCommit,report.renderCommit);
      await page.waitForFunction(()=>document.getElementById('world')?.dataset.heroReady==='true'&&document.getElementById('world')?.dataset.windmillReady==='true'&&document.getElementById('world')?.dataset.natureReady==='true');
      await click(page,'#continue');const continued=await state(page);assert.deepEqual(continued.restoredSiteIds,evidence.restoredSiteIds);record('continue-earned',{file:evidence.file,originCommit:evidence.originCommit,originTimestamp:evidence.timestamp});
      // Duplicate pier subjects reached by genuine movement, not position edits.
      if(site==='pier_hoist')await walkTo(page,{x:-38,z:42.8});await walkTo(page,{x,z});
      if(open)await inspect(page,site);await page.waitForTimeout(1400);await press(page,'KeyM');
      const file=`still-${ref}.png`,snapshot=await state(page),measurement=JSON.parse(await page.locator('#world').getAttribute('data-composition'));
      assert.equal(measurement.camera.yawDegrees,35);assert.equal(measurement.camera.pitchDegrees,52);assert.equal(measurement.camera.span,8.4);
      const lighting=JSON.parse(await page.locator('#world').getAttribute('data-lighting-rig'));
      report.stills.push({file,sha256:await shot(page,file),renderCommit:report.renderCommit,runtimeCommit,resolution:{width:1920,height:1080},matchedRef:`ref-${ref}`,scene:earned.composition.find(c=>c.ref===`ref-${ref}`).name,repairOpen:open,timestamp:new Date().toISOString(),tick:snapshot.tick,position:snapshot.player.position,restoredSiteIds:snapshot.restoredSiteIds,measurement,lighting,saveOrigin:{directory:origin,...evidence}});
      if(ref==='01'){
        await inspect(page,'pier_hoist');assert.equal((await state(page)).inspectionId,'pier_hoist');await press(page,'Escape');assert.equal((await state(page)).inspectionId,null);
        await press(page,'Escape');assert.equal((await state(page)).paused,true);const paused=await page.locator('#world').getAttribute('data-domain-state');
        const warm=await shot(page,'regression-warm.png');await click(page,'#style-toggle');await page.waitForTimeout(250);const cool=await shot(page,'regression-cool.png');assert.notEqual(warm,cool);assert.equal(await page.locator('#world').getAttribute('data-domain-state'),paused);
        report.regression.push({scope:'Supported Continue, actual keyboard walk/inspection/exit/pause and explicit renderer-only warm/cool swap',pausedDomainSha256:digest(paused),warmSha256:warm,coolSha256:cool,unchanged:true});
      }
      assert.equal(await page.locator('#world').getAttribute('data-shadow-ready'),'true');assert.equal(await page.locator('#world').getAttribute('data-programs-linked'),'true');assert.deepEqual(errors,[]);
      report.renderer=await page.locator('#world').getAttribute('data-unmasked-renderer');console.log(`native C1 ref-${ref}: saved origin ${evidence.originCommit.slice(0,7)}, render ${runtimeCommit.slice(0,7)}, ordinary walking, ${snapshot.restoredSiteIds.length}/8`);
    }finally{report.errors.push(...errors);await context.close();await browser.close();}
  }
  assert.equal(report.stills.length,6);report.result='six native C1 captures and short actual-input regression completed';
}catch(error){report.result='C1 capture error';report.failure=error.stack;process.exitCode=1;}finally{
  report.finished=new Date().toISOString();report.actions=actions;await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  const lines=['# C1 native capture manifest','',`Render source: ${report.renderCommit}. Every still separately records runtime metadata and unchanged earned-save origin 731c0cd.`,report.scope,'','| Still | Matched ref | Scene | Runtime | Resolution | Timestamp | Save origin |','| --- | --- | --- | --- | --- | --- | --- |',...report.stills.map(s=>`| ${s.file} | ${s.matchedRef} | ${s.scene} | ${s.runtimeCommit} | 1920×1080 | ${s.timestamp} | ${s.saveOrigin.file}, tick ${s.saveOrigin.tick} |`),'','Camera locked at 35°/52°/8.4 m; inset 35°/58°/5.8 m, unchanged 1.68 m hero. No free zoom, camera-only actor scaling, edited saved positions or approval flags. Native originals are untouched. The storage snapshots were earned by the complete actual-input 731 expedition and loaded only with the supported Continue control for art-only captures.','',`Result: ${report.result}; collected browser errors: ${report.errors.length}. No signing, deployment or public publishing.`,`Failure (if any): ${report.failure??'none'}`];await writeFile(join(out,'MANIFEST.md'),lines.join('\n')+'\n');console.log(JSON.stringify({path:out,result:report.result,stills:report.stills.length,errors:report.errors,failure:report.failure},null,2));
}
