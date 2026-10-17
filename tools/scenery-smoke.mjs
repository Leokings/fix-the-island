import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {openGame,state,click,actions,record} from './browser-play.mjs';
import {cpuImportedModel,pathTo} from './imported-geometry.mjs';

const phase=process.argv[2]??'before',out=resolve(process.argv[3]??'artifacts/scenery-pass/current');await mkdir(out,{recursive:true});
const model=await cpuImportedModel(),source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const report={phase,source,scope:'Three actual-input scenery viewpoints and unchanged supported Save/Continue checkpoints. Not a fresh repair journey or connected review.',frames:[],moves:[],errors:[],complete:false};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
async function walk(page,target,radius=.3){
  for(const point of pathTo(model,(await state(page)).player.position,target,radius).slice(1)){
    let arrived=false;
    for(let i=0;i<65;i++){
      await page.waitForFunction(()=>{const s=JSON.parse(document.getElementById('world').dataset.domainState);return Math.hypot(s.player.velocity.x,s.player.velocity.z)<.02;});
      const before=await state(page);if(distance(before.player.position,point)<.23){arrived=true;break;}
      const pulse=model.steering.planPulse(model.level,before.player,point,new Set(before.restoredSiteIds),{from:before.player.position,to:point,radius:.7});
      assert(pulse,`No safe keyboard pulse from ${JSON.stringify(before.player.position)} to ${JSON.stringify(point)}`);
      const keys=[...(pulse.input.brisk?['ShiftLeft']:[]),...pulse.keys];
      try{for(const key of keys)await page.keyboard.down(key);await new Promise(r=>setTimeout(r,pulse.holdMs));}finally{for(const key of keys)await page.keyboard.up(key);}
      record('scenery-walk',{keys,requestedMs:pulse.holdMs,before:before.player.position,target:point});
    }
    assert(arrived,`Keyboard arrival budget at ${JSON.stringify((await state(page)).player.position)} toward ${JSON.stringify(point)}`);
  }
}
async function capture(page,name){
  await page.waitForTimeout(350);const snapshot=await state(page),runtime=await page.locator('meta[name="fix-the-island-build"]').getAttribute('content');assert.equal(runtime,source);
  const file=`${phase}-${name}-${page.viewportSize().width}.png`;await page.screenshot({path:join(out,file)});
  report.frames.push({file,time:new Date().toISOString(),runtime,viewport:page.viewportSize(),position:snapshot.player.position,restored:snapshot.restoredSiteIds});
}
let game;
try{
  if(phase==='before'){
    game=await openGame({width:1920,height:1080},{touch:true});const{page,context}=game;await click(page,'#start-practice');
    for(const name of ['pier_hoist','village_pump','tidal_sluice']){
      if(name!=='pier_hoist')await walk(page,model.level.sitePositions[name],3);
      await click(page,'#save');await context.storageState({path:join(out,`${name}-earned.json`)});
      await capture(page,name);await page.setViewportSize({width:667,height:375});await capture(page,name);await page.setViewportSize({width:1920,height:1080});
    }
    report.errors.push(...game.errors);await game.context.close();await game.browser.close();game=null;
  }else{
    const before=JSON.parse(await readFile(join(out,'before-report.json'),'utf8'));report.origin={source:before.source,report:'before-report.json'};
    for(const name of ['pier_hoist','village_pump','tidal_sluice']){
      const storage=join(out,`${name}-earned.json`),bytes=await readFile(storage),hash=createHash('sha256').update(bytes).digest('hex');
      game=await openGame({width:1920,height:1080},{touch:true,storageState:storage});const{page,context}=game;await click(page,'#continue');
      const origin=before.frames.find(f=>f.file===`before-${name}-1920.png`),snapshot=await state(page);assert.deepEqual(snapshot.player.position,origin.position,'Same genuinely walked viewpoint remains clear');assert.equal(snapshot.restoredSiteIds.length,0);
      await capture(page,name);await page.setViewportSize({width:667,height:375});await capture(page,name);
      if(name==='pier_hoist'){
        await page.setViewportSize({width:1920,height:1080});const start=(await state(page)).player.position;
        // Walk around the camp's exterior on actual geometry, then touch along
        // the same public clearing. Collisions remain active throughout.
        await walk(page,{x:start.x+2,z:start.z-1},.5);const after=(await state(page)).player.position;assert(distance(start,after)>1);report.moves.push({input:'desktop WASD',before:start,after});
        await page.setViewportSize({width:667,height:375});const j=await page.locator('#joystick').boundingBox(),cdp=await context.newCDPSession(page);assert(j);
        const p=(await state(page)).player.position,x=j.x+j.width/2,y=j.y+j.height/2;
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+24,y:y+8}]});await new Promise(r=>setTimeout(r,450));await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(400);
        const end=await state(page);assert(distance(p,end.player.position)>.1);assert(Math.hypot(end.player.velocity.x,end.player.velocity.z)<.02);report.moves.push({input:'667 landscape touch joystick + release',before:p,after:end.player.position});await capture(page,'camp-roam');
      }
      assert.equal(createHash('sha256').update(await readFile(storage)).digest('hex'),hash);report.errors.push(...game.errors);await context.close();await game.browser.close();game=null;
    }
  }
  assert.deepEqual(report.errors,[]);report.actions=actions;report.complete=true;
}catch(error){report.failure=error.stack??String(error);process.exitCode=1;if(game)await game.page.screenshot({path:join(out,`${phase}-failure.png`)}).catch(()=>{});}
finally{if(game){report.errors.push(...game.errors);await game.context.close();await game.browser.close();}await writeFile(join(out,`${phase}-report.json`),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({out,phase,source,complete:report.complete,errors:report.errors,failure:report.failure}));}
