import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import {routeModel}from'./route-model.mjs';
export const actions=[];
export const record=(kind,detail)=>actions.push({time:new Date().toISOString(),kind,...detail});
export async function openGame(viewport={width:1920,height:1080},options={}) {
  // Default Chrome GPU path. B proofs leave storageState absent and start fresh.
  // Art-only callers may pass an unchanged, hash-verified earned checkpoint.
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport,deviceScaleFactor:1,...(options.touch?{hasTouch:true}:{}),...(options.storageState?{storageState:options.storageState}:{})});
  // Observation only. These trusted input timestamps do not dispatch events,
  // write storage, alter game state or expose any completion/movement setters.
  await context.addInitScript(()=>{
    window.__journeyKeyEvents=[];
    for(const type of ['keydown','keyup'])window.addEventListener(type,event=>{
      if(event.isTrusted&&!event.repeat)window.__journeyKeyEvents.push({type,code:event.code,time:performance.now()});
    });
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',(error)=>errors.push(error.message));page.on('console',(message)=>{if(message.type()==='error')errors.push(message.text());});
  const response=await page.goto(`http://127.0.0.1:5173/${options.query??''}`,{waitUntil:'networkidle'});assert.equal(response.status(),200);
  await page.waitForFunction(()=>Number(document.getElementById('world')?.dataset.frames??0)>8);
  return {browser,context,page,errors};
}
export async function state(page) {return JSON.parse(await page.locator('#world').getAttribute('data-domain-state'));}
export async function click(page,locator,description=locator) {record('pointer-click',{target:description});await page.locator(locator).click();await page.waitForTimeout(50);}
export async function press(page,key) {record('key-press',{key});await page.keyboard.press(key);await page.waitForTimeout(50);}
export async function walkTo(page,target,tolerance=.15,contract={}) {
  const held=new Set(),model=await routeModel();
  await page.waitForFunction(()=>{const s=JSON.parse(document.getElementById('world').dataset.domainState);return Math.hypot(s.player.velocity.x,s.player.velocity.z)<.02;},{},{timeout:2000});
  const initial=await state(page),start=contract.from??initial.player.position,corridor={from:start,to:target,radius:contract.radius??.65};
  const count=Math.max(1,Math.ceil(Math.hypot(target.x-start.x,target.z-start.z)/.9));let next=1,stalled=0,recoveries=0,lastWaypoint=target;
  const budget=Math.ceil(Math.hypot(target.x-start.x,target.z-start.z)*30)+60;
  record('walk-target',{target,tolerance,steeringWaypoints:count,corridor,routeId:contract.id??null});
  const diagnostic=(snapshot,keys=[])=>({target,subtarget:lastWaypoint,player:snapshot.player,corridor,keys,...model.steering.standingDiagnostic(model.level,snapshot.player.position,new Set(snapshot.restoredSiteIds))});
  try{
    for(let i=0;i<budget;i++){
      const snapshot=await state(page),position=snapshot.player.position;
      assert.equal(snapshot.inspectionId,null,'Close inspection before walking');assert.equal(snapshot.paused,false);
      const support=model.steering.standingDiagnostic(model.level,position,new Set(snapshot.restoredSiteIds));
      assert.equal(support.failure,null,`Actual released pose must retain whole-foot support: ${JSON.stringify(support)}`);
      if(model.steering.distanceFromCorridor(position,corridor)>corridor.radius){
        assert(!contract.recovery&&recoveries++<2,'Bounded input recovery exhausted');
        const dx=target.x-start.x,dz=target.z-start.z,len=dx*dx+dz*dz,t=len?Math.max(0,Math.min(1,((position.x-start.x)*dx+(position.z-start.z)*dz)/len)):0;
        const returnPoint={x:start.x+dx*t,z:start.z+dz*t};assert(Math.hypot(returnPoint.x-position.x,returnPoint.z-position.z)<=1.2,'Scheduling recovery exceeds local bounded detour');
        record('released-input-recovery',{from:position,to:returnPoint,reason:'observed scheduling drift outside diagnostic corridor; actual support valid'});
        await walkTo(page,returnPoint,tolerance,{from:position,radius:.65,recovery:true});continue;
      }
      const waypoint={x:start.x+(target.x-start.x)*next/count,z:start.z+(target.z-start.z)*next/count};lastWaypoint=waypoint;
      if(Math.hypot(waypoint.x-position.x,waypoint.z-position.z)<=tolerance){
        if(next===count){record('walk-arrived',{target,position,velocity:snapshot.player.velocity,diagnostic:diagnostic(snapshot)});return snapshot;}
        next++;continue;
      }
      const pulse=model.steering.planPulse(model.level,snapshot.player,waypoint,new Set(snapshot.restoredSiteIds),corridor);
      if(!pulse){const detail=diagnostic(snapshot);record('walk-blocked',detail);throw new Error(`No safe bounded input pulse: ${JSON.stringify(detail)}`);}
      const eventIndex=await page.evaluate(()=>window.__journeyKeyEvents.length),started=performance.now();
      if(pulse.input.brisk){await page.keyboard.down('ShiftLeft');held.add('ShiftLeft');record('key-down',{key:'ShiftLeft'});}
      for(const key of pulse.keys){await page.keyboard.down(key);held.add(key);record('key-down',{key});}
      // Node's timer avoids an extra browser round trip while keys are held.
      await new Promise(resolve=>setTimeout(resolve,pulse.holdMs));
      for(const key of held){await page.keyboard.up(key);record('key-up',{key});}held.clear();
      const protocolSpanMs=performance.now()-started;
      const events=await page.evaluate(index=>window.__journeyKeyEvents.slice(index),eventIndex);
      const relevant=events.filter(e=>pulse.keys.includes(e.code));
      const down=relevant.filter(e=>e.type==='keydown'),up=relevant.filter(e=>e.type==='keyup');
      assert.equal(down.length,pulse.keys.length,'Every actual keydown must be observed');assert.equal(up.length,pulse.keys.length,'Every actual keyup must be observed');
      const heldMs=Math.max(...up.map(e=>e.time))-Math.min(...down.map(e=>e.time));
      // Read progress only AFTER key release and braking have completed.
      await page.waitForFunction(()=>{const s=JSON.parse(document.getElementById('world').dataset.domainState);return Math.hypot(s.player.velocity.x,s.player.velocity.z)<.02;},{},{timeout:2000});
      const after=await state(page),moved=Math.hypot(after.player.position.x-position.x,after.player.position.z-position.z);
      record('walk-pulse',{target,waypoint,keys:pulse.keys,brisk:pulse.input.brisk,requestedMs:pulse.holdMs,measuredHeldMs:heldMs,measurement:'trusted browser keydown-to-keyup timestamps',protocolSpanMs,latencyAllowanceMs:80,withinTimingEnvelope:heldMs<=pulse.holdMs*1.2+80,before:position,after:after.player.position,velocity:after.player.velocity,minimumClearance:pulse.minClearance});
      if(heldMs>pulse.holdMs*1.2+80)record('scheduling-overrun',{requestedMs:pulse.holdMs,observedMs:heldMs,released:true,next:'replan from observed released pose; no physics relaxation',diagnostic:diagnostic(after,pulse.keys)});
      stalled=moved<.005?stalled+1:0;
      if(stalled>2){const detail=diagnostic(after,pulse.keys);record('walk-blocked',detail);throw new Error(`Traversal blocked after released pulses: ${JSON.stringify(detail)}`);}
    }
    const detail=diagnostic(await state(page));record('walk-blocked',detail);throw new Error(`Walk pulse budget exhausted: ${JSON.stringify(detail)}`);
  }finally{for(const key of held){await page.keyboard.up(key);record('key-up',{key});}await page.keyboard.up('ShiftLeft');await page.waitForTimeout(350);}
}
export async function followRoute(page,id,reverse=false){
  const model=await routeModel(),contract=model.routes[id];assert(contract,`Unknown public route ${id}`);
  const snapshot=await state(page);for(const parent of contract.requires)assert(snapshot.restoredSiteIds.includes(parent),`Actual progression required for ${id}: ${parent}`);
  const points=reverse?[...contract.points].reverse():contract.points;
  assert(Math.hypot(snapshot.player.position.x-points[0].x,snapshot.player.position.z-points[0].z)<=contract.acceptance+.02,`Walk to the declared corridor entrance, never shortcut to ${id}`);
  record('route-start',{id,reverse,requires:contract.requires,position:snapshot.player.position});
  for(let i=1;i<points.length;i++)await walkTo(page,points[i],contract.acceptance,{from:points[i-1],radius:contract.corridorRadius,id});
  record('route-finish',{id,reverse,position:(await state(page)).player.position});
}
export async function selectSocket(page,slotId) {
  // Actual keyboard focus alternative for crowded physical sockets.
  // Wait for each press to land before the next, so a slow frame cannot make two presses overshoot the socket.
  for(let i=0;i<24;i++){
    const current=(await state(page)).editor?.slotId;if(current===slotId)return;
    await press(page,'BracketRight');
    await page.waitForFunction(previous=>JSON.parse(document.getElementById('world').dataset.domainState).editor?.slotId!==previous,current,{timeout:3000});
  }
  throw new Error(`Socket is unavailable: ${slotId}`);
}
export async function tab(page,name) {
  const step={parts:'place',connect:'connect',configure:'set'}[name]??name;
  await click(page,`[data-key="pb-step-${step}"]`,`${name} build step`);
}
export async function setting(page,slotId,settingId) {
  await selectSocket(page,slotId);await tab(page,'configure');
  for(let i=0;i<16;i++){const snapshot=await state(page),site=snapshot.sites.find((s)=>s.id===snapshot.inspectionId);if(site.draft.artifact.parts.find((p)=>p.slotId===slotId)?.settingId===settingId)return;await press(page,'KeyF');}
  throw new Error(`Detent unavailable: ${slotId}/${settingId}`);
}
export async function place(page,slotId,optionId) {
  await tab(page,'parts');
  const snapshotBefore=await state(page),siteBefore=snapshotBefore.sites.find((s)=>s.id===snapshotBefore.inspectionId);
  const fitted=siteBefore?.draft.artifact.parts.find((part)=>part.slotId===slotId);
  if(fitted?.optionId===optionId)return;
  await click(page,`[data-key="pb-part-${slotId}"]`,`build slot ${slotId}`);
  if(fitted) {
    await click(page,`[data-key="pb-swap-${optionId}"]`,`swap ${slotId} to ${optionId}`);
    const after=await state(page),updated=after.sites.find((s)=>s.id===after.inspectionId);
    assert.equal(updated?.draft.artifact.parts.find((part)=>part.slotId===slotId)?.optionId,optionId);
    return;
  }
  const variant=page.locator(`[data-key="pb-variant-${optionId}"]`);
  const selected=await state(page);
  const selectedOption=selected.editor?.optionId;
  if(selectedOption!==optionId) {
    assert.equal(await variant.count(),1,`Stock ${optionId} is not selectable in slot ${slotId}`);
    await click(page,`[data-key="pb-variant-${optionId}"]`,`select stock ${optionId}`);
  }
  const anchors=JSON.parse(await page.locator('#world').getAttribute('data-hit-anchors'));
  const anchor=anchors.find((a)=>a.view==='world'&&a.kind==='socket'&&a.slotId===slotId&&a.visible);
  assert(anchor,'The selected stock needs a visible physical socket');record('pointer-click',{target:`physical socket ${slotId}`,x:anchor.x,y:anchor.y});
  await page.mouse.click(anchor.x,anchor.y);await page.waitForTimeout(90);
  const snapshot=await state(page),site=snapshot.sites.find((s)=>s.id===snapshot.inspectionId);
  assert.equal(site.draft.artifact.parts.find((p)=>p.slotId===slotId)?.optionId,optionId);
}
export async function join(page,from,to) {
  await tab(page,'connect');
  const selectPort=async(endpoint)=>{
    const snapshot=await state(page),site=snapshot.sites.find((s)=>s.id===snapshot.inspectionId);
    const part=site?.draft.artifact.parts.find((item)=>item.id===endpoint.partId);
    assert(part,`Part unavailable for port: ${JSON.stringify(endpoint)}`);
    await selectSocket(page,part.slotId);
    const selector=`[data-key="pb-port-${endpoint.partId}-${endpoint.portId}"]`,button=page.locator(selector);
    assert.equal(await button.count(),1,`Port control missing: ${selector}`);
    await button.focus();record('keyboard-focus',{target:`port ${endpoint.partId}/${endpoint.portId}`});
    await page.keyboard.press('Enter');record('keyboard-activate',{target:`port ${endpoint.partId}/${endpoint.portId}`});
    await page.waitForTimeout(50);
  };
  await selectPort(from);
  await selectPort(to);
  // The join lands on the game's next frame; wait for it rather than a fixed delay.
  await page.waitForFunction(({from,to})=>{const s=JSON.parse(document.getElementById('world').dataset.domainState),site=s.sites.find(x=>x.id===s.inspectionId);return site?.draft.artifact.connections.some(e=>e.from.partId===from.partId&&e.from.portId===from.portId&&e.to.partId===to.partId&&e.to.portId===to.portId);},{from,to},{timeout:2000}).catch(()=>{});
  const snapshot=await state(page),site=snapshot.sites.find((s)=>s.id===snapshot.inspectionId);
  assert(site?.draft.artifact.connections.some((e)=>e.from.partId===from.partId&&e.from.portId===from.portId&&e.to.partId===to.partId&&e.to.portId===to.portId),
    `Build view did not join ${JSON.stringify(from)} to ${JSON.stringify(to)}`);
}
export async function inspect(page,id) {
  await page.waitForFunction((id)=>document.getElementById('world')?.dataset.focus===id,id);await press(page,'KeyE');
  await page.waitForFunction((id)=>document.getElementById('world')?.dataset.inspection===id,id);
}
export async function confirmPractice(page,rationale) {
  await press(page,'KeyT');
  const snapshot=await state(page),site=snapshot.sites.find((s)=>s.id===snapshot.inspectionId);assert.equal(site.advice?.valid,true,site.feedback);
  await page.waitForFunction(()=>{const s=JSON.parse(document.getElementById('world').dataset.domainState);return s.sites.find((site)=>site.id===s.inspectionId)?.testSeconds===0;});
  await click(page,'[data-key="rationale"]','Explain design');record('text-input',{target:'Your one-line answer to the council',text:rationale});await page.getByRole('textbox',{name:'Your one-line answer to the council'}).fill(rationale);
  await click(page,'[data-key="review"]','Review construction');await click(page,'[data-key="submit"]','Submit for local deterministic checks');
  await page.waitForFunction((id)=>JSON.parse(document.getElementById('world').dataset.domainState).restoredSiteIds.includes(id),site.id);
}
