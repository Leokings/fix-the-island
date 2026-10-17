import{mkdir,writeFile}from'node:fs/promises';import{join}from'node:path';import{fileURLToPath}from'node:url';
import assert from'node:assert/strict';import{openGame,state,click,walkTo,actions}from'./browser-play.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),stamp=new Date().toISOString(),out=join(root,'artifacts/stage-b/input-timing',stamp.replaceAll(':','-').replaceAll('.','-'));await mkdir(out,{recursive:true});
const{browser,context,page,errors}=await openGame();const report={scope:'Short actual keyboard timing/traversal diagnostic; zero progression, storage injection or signing',started:stamp};
try{await click(page,'#start-practice');report.initial=await state(page);
  for(let i=0;i<3;i++){await walkTo(page,{x:-38,z:42.8});await walkTo(page,{x:-38,z:44});}
  report.final=await state(page);assert.deepEqual(report.final.restoredSiteIds,[]);assert.deepEqual(errors,[]);
  report.pulses=actions.filter(action=>action.kind==='walk-pulse');assert(report.pulses.length>=12);
  report.timingOverruns=report.pulses.filter(pulse=>!pulse.withinTimingEnvelope).length;report.result='observed input timing and traversal checks completed';
}catch(error){report.result='input timing check error';report.failure=error.stack;process.exitCode=1;}
finally{report.errors=errors;report.actions=actions;report.finished=new Date().toISOString();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await context.close();await browser.close();console.log(JSON.stringify({path:out,result:report.result,pulses:report.pulses?.length,failure:report.failure,errors},null,2));}
