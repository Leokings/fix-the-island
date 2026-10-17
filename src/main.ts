import './game.css';
import { activeExpeditionId, createExpeditionId, createGenLayerAdapter, expeditionStorageKey, FIXTURE_VERSION, getRepairScenario, previousExpeditionId, REPAIR_SCENARIOS, resolveGenLayerConfig, rotateExpeditionId, siteContractAddress } from './genlayer';
import type { Address, InjectedProvider, RepairEndpoint, RepairState } from './genlayer';
import { discoverInjectedProvider } from './genlayer/injected-provider';
import { DEPLOYED_SITE_ADDRESSES, STUDIONET_SITE_ADDRESSES } from './genlayer/deployments';
import { SITE_PLAN } from './content/site-plan';
import { World } from './domain/world';
import { sameSession,submissionAvailable,submitRepair,type SubmissionSession } from './application/submit-repair';
import { boundTickets,recoverRepairs } from './application/recover-repairs';
import { UnknownSubmissionStore } from './application/unknown-submission';
import type { Command, WorldSnapshot } from './domain/world';
import { loadSave, saveKey, storeSave,loadPracticeSession,previousPracticeKey } from './domain/save';
import { FixedTick } from './domain/fixed-tick';
import { BrowserInput } from './input/browser-input';
import { ThreeRenderer } from './render/three-renderer';
import { withImportedEquipment } from './render/imported-world';
import { buildStylizedIsland } from './render/island/stylized-world';
import { loadWindmill } from './render/windmill-asset';
import { loadRepairPropLibrary } from './render/environment/repair-props';
import { COOL_STYLE, WARM_STYLE } from './render/presets';
import type { RendererContract } from './render/contract';
import { repairRegions } from './render/layout';
import { GameHud } from './ui/game-hud';
import { RepairPanel } from './ui/repair-panel';
import { CouncilReveal } from './ui/council/council-reveal';
import { Tutorial } from './ui/tutorial';
import { councilDecisionFor } from './ui/council/site-council-model';
import { inferPumpDesign } from './ui/build-view';
import { COMMONS } from './content/stylized-island';
import type { RepairPanelAction, RepairPanelModel } from './ui/repair-panel';
import { siteCopy } from './ui/player-copy';
import { nextObjective } from './ui/quest-guide';
import { GameAudio } from './audio/game-audio';
import './ui/field-journal.css';

document.body.classList.add('production-ui');

declare const __BUILD_COMMIT__:string;
document.querySelector<HTMLMetaElement>('meta[name="fix-the-island-build"]')!.content=__BUILD_COMMIT__;
const host=document.getElementById('world')!,interfaceHost=document.getElementById('interface')!;
// First-visit tutorial: one guided practice repair, then an offer to play for real. Display only.
const tutorial=new Tutorial(interfaceHost,{connect:()=>{void connect();}});
// The imported visible mesh is the floor/collision source, not old routes.
const repairProps=await loadRepairPropLibrary();
// The stylized island (GAME-DESIGN §12) supplies both the visible world and its walk/collision data.
const importedIsland=withImportedEquipment(buildStylizedIsland(),repairProps,await loadWindmill());
const islandLevel=importedIsland.level;
host.dataset.importedWorld=JSON.stringify(importedIsland.stats);
// Development-only read handle for layout/reachability QA. Never used by gameplay.
if(import.meta.env.DEV)Object.assign(window,{__islandLevel:islandLevel,__islandGroup:importedIsland.group});
const network=import.meta.env.VITE_GENLAYER_NETWORK??'studionet';
const fallbackAddresses=network==='testnetBradbury'?DEPLOYED_SITE_ADDRESSES:network==='studionet'?STUDIONET_SITE_ADDRESSES:null;
const configuredAddresses=network==='studionet'&&STUDIONET_SITE_ADDRESSES?JSON.stringify(STUDIONET_SITE_ADDRESSES):import.meta.env.VITE_GENLAYER_SITE_ADDRESSES??(fallbackAddresses?JSON.stringify(fallbackAddresses):'');
const config=resolveGenLayerConfig({VITE_GENLAYER_NETWORK:network,VITE_GENLAYER_SITE_ADDRESSES:configuredAddresses});
const adapter=createGenLayerAdapter(config);let adapterState:RepairState=adapter.getState();
let world=new World(islandLevel,REPAIR_SCENARIOS),key=saveKey('practice',FIXTURE_VERSION),started=false,cool=false,mute=true,saveNotice='',actionNotice='';
let hasSave=false,hasPreviousPractice=false,lastSavedRevision=-1,lastCheckpoint=0,request=0,previousTime=performance.now();
let sessionEpoch=0;
let sessionWallet:Address|null=null,operationBusy=false,connecting=false,reviewSession:SubmissionSession|null=null,recoveryController:AbortController|null=null;
let reviewCount=0,approvalCount=0;
let lastRecoveryRevision=-1;
let nextRecoveryAt=0;
// The recovery summary is re-derived each frame until another notice replaces it:
// review results reach the world on its next tick, after recovery returns.
let liveRecoveryNotice='',recoveryNoticeSuffix='';
function recoverySummary():string {
  const snapshot=world.snapshot(),restoredCount=snapshot.restoredSiteIds.length,pendingCount=savedTickets().length;
  const revisions=snapshot.sites.filter(site=>site.phase==='revision').map(site=>site.title);
  return `${restoredCount?`${restoredCount} verified repair${restoredCount===1?' restored':'s restored'}.`:'Wallet progress checked.'}${pendingCount?` ${pendingCount} review${pendingCount===1?' is':'s are'} still being checked automatically.`:''}${revisions.length?` ${revisions.join(', ')}: your saved build is ready to test and retry.`:''}${recoveryNoticeSuffix}`;
}
const uncertainty=new UnknownSubmissionStore({getItem:(key)=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value),removeItem:(key)=>localStorage.removeItem(key)});
let uncertain=false,inFlightPrepared:import('./genlayer').PreparedRepair|null=null;
function currentSession():SubmissionSession|null {return world.mode==='connected'&&world.context&&sessionWallet?.toLowerCase()===world.context.caller.toLowerCase()?{owner:world,context:world.context,epoch:sessionEpoch}:null;}
function savedTickets(){return world.snapshot().sites.flatMap((site)=>site.phase==='pending'&&site.ticket?[site.ticket]:[]);}
function refreshRecovery():void {
  const snapshot=world.snapshot();lastRecoveryRevision=snapshot.revision;
  const session=currentSession();reviewCount=session?boundTickets(adapter,session,savedTickets()).filter(ticket=>!snapshot.restoredSiteIds.includes(ticket.prepared.siteId)).length:0;
  approvalCount=session?adapter.getApprovalEvidence(session.context.caller).filter((proof)=>!['restoring','restored'].includes(snapshot.sites.find((site)=>site.id===proof.prepared.siteId)?.phase??'damaged')).length:0;
  uncertain=!!session&&uncertainty.read(session.context).uncertain;
}
try{hasSave=localStorage.getItem(key)!==null;hasPreviousPractice=localStorage.getItem(previousPracticeKey(key))!==null;}catch{saveNotice='Local storage unavailable. This expedition can still be played.';}
const input=new BrowserInput(document.getElementById('joystick')!,document.getElementById('interact')!);
const renderer:RendererContract=new ThreeRenderer(null,repairProps,importedIsland.dressing,importedIsland.group),clock=new FixedTick();
const audio=new GameAudio();
function save():void {
  if(!started)return;
  try{storeSave(localStorage,key,world.exportSave());saveNotice=world.mode==='practice'?'Local practice saved':'Caller-bound drafts and recovery tickets saved';hasSave=true;lastSavedRevision=world.snapshot().revision;}
  catch{saveNotice='Save failed. Keep this page open or retry Save; progress was not erased.';}
}
function start(resume:boolean,previous=false,tutorialOnRequest=false):void {
  actionNotice='';
  recoveryController?.abort();reviewSession=null;sessionEpoch++;adapter.disconnect();sessionWallet=null;operationBusy=false;reviewCount=approvalCount=0;
  input.clear();world=new World(islandLevel,REPAIR_SCENARIOS);key=saveKey('practice',FIXTURE_VERSION);lastSavedRevision=-1;
  try{const data=loadPracticeSession(localStorage,key,previous?'previous':resume?'resume':'new',{mode:'practice',levelId:islandLevel.id,context:null,compatibleLevelIds:islandLevel.saveCompatibleLevelIds??[]});if(data)world.restoreSave(data);hasPreviousPractice=localStorage.getItem(previousPracticeKey(key))!==null;}
  catch(error){actionNotice=error instanceof Error?error.message:'Save could not be read. Use New local expedition.';if(resume)return;}
  started=true;save();
  if(!resume)tutorial.maybeStart(world.snapshot(),tutorialOnRequest);
}
async function connect():Promise<void> {
  // Only an explicit player action can request an injected wallet. The build
  // tools never invoke this route, submit transactions, or deploy contracts.
  if(!config.enabled){actionNotice='Connected mode is unconfigured. Local progress stays separate.';return;}
  const provider=await discoverInjectedProvider();
  if(!provider){actionNotice='No injected wallet. Local practice remains separate.';return;}
  if(operationBusy||connecting)return;
  operationBusy=true;connecting=true;actionNotice='Connecting your wallet and checking the island…';const owner=world;
  let state:RepairState;
  try{state=await adapter.connect(provider);}finally{connecting=false;operationBusy=false;}
  if(world!==owner)return;
  if(state.status!=='ready'){
    actionNotice=state.status==='disabled'?`Connected unavailable: ${state.reason}`:'message' in state?`Connected unavailable: ${state.message}`:`Connected unavailable: ${state.status}`;
    return;
  }
  const expeditionKey=expeditionStorageKey(config.chainId,config.contractAddress,state.wallet,FIXTURE_VERSION);
  let expeditionId:import('./genlayer').Hash;
  try{expeditionId=activeExpeditionId(localStorage,expeditionKey);}catch{expeditionId=createExpeditionId();actionNotice='Browser storage is unavailable; this connected expedition can be played now, but its ID will not survive reload.';}
  const context={caller:state.wallet,expeditionId,contractAddress:config.contractAddress,chainId:config.chainId,...(config.siteAddresses?{siteAddresses:config.siteAddresses}:{})};
  adapter.setExpedition(context.expeditionId);
  world=new World(islandLevel,REPAIR_SCENARIOS,'connected',context);key=saveKey('connected',FIXTURE_VERSION,context);
  actionNotice='Connected drafts loaded without cached approvals. Reverify original broadcasts to recover routes; a gated saved position returns to the landing.';
  try{const saved=loadSave(localStorage,key,{mode:'connected',levelId:islandLevel.id,context,compatibleLevelIds:islandLevel.saveCompatibleLevelIds??[]});if(saved)world.restoreSave(saved);}catch{actionNotice='Connected cache unreadable; no cached approvals granted.';}
  started=true;input.clear();save();
  reviewSession=currentSession();refreshRecovery();
  actionNotice='Connected. Restoring your verified repairs and checking unfinished reviews…';
  await recover('all',true);
}
function startNewConnectedExpedition():void {
  if(world.mode!=='connected'||!world.context||operationBusy){actionNotice='Finish or recover the current wallet operation before starting a new connected expedition.';return;}
  if(savedTickets().length||uncertainty.read(world.context).uncertain){actionNotice='Recover or resolve every submitted wallet review before starting a new expedition; pending broadcasts stay bound to their original run.';return;}
  save();
  const previous=world.context,expeditionKey=expeditionStorageKey(previous.chainId,previous.contractAddress,previous.caller,FIXTURE_VERSION);
  let expeditionId:import('./genlayer').Hash;
  try{expeditionId=rotateExpeditionId(localStorage,expeditionKey);}catch{actionNotice='Could not save a new expedition ID. Enable browser storage and try again.';return;}
  const context={...previous,expeditionId};
  recoveryController?.abort();reviewSession=null;sessionEpoch++;adapter.setExpedition(context.expeditionId);
  world=new World(islandLevel,REPAIR_SCENARIOS,'connected',context);key=saveKey('connected',FIXTURE_VERSION,context);
  started=true;input.clear();lastSavedRevision=-1;reviewCount=approvalCount=0;lastRecoveryRevision=-1;
  actionNotice='New connected expedition started. Earlier on-chain approvals remain in your old expedition and cannot unlock this one.';
  save();
}
async function resumePreviousConnectedExpedition():Promise<void> {
  if(world.mode!=='connected'||!world.context||operationBusy)return;
  const previous=world.context,keyForRun=expeditionStorageKey(previous.chainId,previous.contractAddress,previous.caller,FIXTURE_VERSION);
  let expeditionId:import('./genlayer').Hash|null;
  try{expeditionId=previousExpeditionId(localStorage,keyForRun);}catch{expeditionId=null;}
  if(!expeditionId){actionNotice='There is no saved previous connected expedition on this browser.';return;}
  const context={...previous,expeditionId};
  try{localStorage.setItem(keyForRun,expeditionId);}catch{actionNotice='Could not select the previous expedition because browser storage is unavailable.';return;}
  recoveryController?.abort();reviewSession=null;sessionEpoch++;adapter.setExpedition(expeditionId);
  world=new World(islandLevel,REPAIR_SCENARIOS,'connected',context);key=saveKey('connected',FIXTURE_VERSION,context);
  try{const data=loadSave(localStorage,key,{mode:'connected',levelId:islandLevel.id,context,compatibleLevelIds:islandLevel.saveCompatibleLevelIds??[]});if(data)world.restoreSave(data);}catch{actionNotice='Previous expedition cache is unreadable; on-chain review evidence remains independently recoverable.';}
  started=true;input.clear();lastSavedRevision=-1;save();refreshRecovery();void recover('all',true);
}
window.addEventListener('island:new-connected-expedition',startNewConnectedExpedition);
window.addEventListener('island:resume-previous-connected-expedition',()=>{void resumePreviousConnectedExpedition();});
async function retryDependencyNotification(event:Event):Promise<void> {
  const detail=(event as CustomEvent<{parentSiteId?:unknown;childSiteId?:unknown}>).detail;
  if(typeof detail?.parentSiteId!=='string'||typeof detail?.childSiteId!=='string'||operationBusy||world.mode!=='connected')return;
  operationBusy=true;actionNotice='Checking the finalized prerequisite before requesting a safe notification retry…';
  try{const txId=await adapter.retryDependencyNotification(detail.parentSiteId,detail.childSiteId);actionNotice=`Notification retry submitted (${txId}). This is not yet a child confirmation; wait for finality, then refresh prerequisite status.`;}
  catch(error){actionNotice=error instanceof Error?error.message:'Notification retry could not be submitted.';}
  finally{operationBusy=false;}
}
window.addEventListener('island:retry-dependency-notification',retryDependencyNotification);
async function recover(kind:'reviews'|'approvals'|'all',discover=false):Promise<void> {
  const session=currentSession();if(!session||operationBusy)return;
  operationBusy=true;reviewSession=session;const controller=new AbortController();recoveryController=controller;
  actionNotice='Checking your saved repairs. You can keep exploring.';
  const deadline=setTimeout(()=>controller.abort(),90000);
  const waitForRestored=(siteId:string,signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{
    const begin=performance.now();
    const check=()=>{if(signal.aborted||!sameSession(session,currentSession())){reject(new Error('Recovery session changed. No cached progress granted.'));return;}
      if(world.snapshot().restoredSiteIds.includes(siteId)){resolve();return;}
      if(performance.now()-begin>15000){reject(new Error('Installation is paused or the grant did not match. Resume the expedition and explicitly recheck; no approval was invented.'));return;}
      setTimeout(check,30);
    };check();
  });
  try{
    if(discover)try{await adapter.discoverRecovery(session.context.caller,controller.signal);}catch{/* Saved originals remain available if history is temporarily unavailable. */}
    const count=await recoverRepairs(adapter,kind==='all'?'all':kind,session,currentSession,{restored:()=>world.snapshot().restoredSiteIds,savedTickets,waitForRestored},controller.signal);
    if(sameSession(session,currentSession())){
      world.resumeVerifiedPosition();
      recoveryNoticeSuffix=!count&&uncertain?' An original wallet request still needs to be checked before retrying that repair.':'';
      actionNotice=liveRecoveryNotice=recoverySummary();}
  }catch(error){if(sameSession(session,currentSession()))actionNotice=error instanceof Error?error.message:'Recovery did not verify an installation.';}
  finally{clearTimeout(deadline);if(recoveryController===controller){operationBusy=false;recoveryController=null;refreshRecovery();nextRecoveryAt=performance.now()+15000;save();}}
}
async function recoverHash():Promise<void> {
  const session=currentSession();if(!session||operationBusy)return;
  const prepared=uncertainty.read(session.context).prepared[0];if(!prepared){actionNotice='Original prepared identity is unavailable. Check original wallet activity; do not invent a recovery ticket.';return;}
  const value=window.prompt(`Original EVM broadcast hash for ${prepared.siteId}, nonce ${prepared.nonce}. This only reads the original transaction; it cannot sign or resubmit.`);
  if(value===null)return;if(!/^0x[0-9a-fA-F]{64}$/.test(value)){actionNotice='Use the exact 32-byte EVM hash from the original wallet activity.';return;}
  operationBusy=true;reviewSession=session;const controller=new AbortController();recoveryController=controller;
  try{const state=await adapter.resume({version:2,chainId:session.context.chainId,contractAddress:siteContractAddress(session.context,prepared.siteId),prepared,evmTxHash:value as import('./genlayer').Hash},controller.signal);if(sameSession(session,currentSession()))actionNotice=`Original-hash read returned ${state.status}. No new broadcast was made.`;}
  catch{actionNotice='Original hash could not be verified. The uncertainty marker remains.';}
  finally{if(recoveryController===controller){operationBusy=false;recoveryController=null;refreshRecovery();save();}}
}
function auditWallet():void {
  const session=currentSession();if(!session||operationBusy)return;
  if(!window.confirm(`Check the original wallet (${session.context.caller}) activity on chain ${session.context.chainId}. If any broadcast exists, Cancel and recover that hash. Confirm ONLY if you checked and NO original transaction was sent. This clears only the uncertainty latch; saved review tickets remain blocking and no retry is automatic.`))return;
  try{uncertainty.acknowledgeNoBroadcast(session.context);refreshRecovery();actionNotice='Player explicitly confirmed the original wallet activity check found no broadcast. Any retry still needs a separate Submit; saved pending tickets were not cleared.';}catch{actionNotice='The uncertainty latch could not be cleared. No new submission permitted.';}
}
const hud=new GameHud(interfaceHost,(action)=>{
  if(action==='start'||action==='replay')start(false);
  if(action==='tutorial')start(false,false,true);
  if(action==='continue'){if(started)enqueue({kind:'Pause'});else start(true);}
  if(action==='previous')start(true,true);
  if(action==='pause')input.enqueue({kind:'Pause'});
  if(action==='save')save();
  if(action==='style'){cool=!cool;renderer.setStyle(cool?COOL_STYLE:WARM_STYLE);hud.setStyleLabel(cool);}
  if(action==='measure'){host.dataset.composition=JSON.stringify(renderer.measureComposition());}
  if(action==='mute')void audio.toggle().then(enabled=>{mute=!enabled;hud.setMuteLabel(mute);}).catch(()=>{actionNotice='Sound could not start. The expedition remains playable with sound off.';});
  if(action==='connected')void connect();
  if(action==='recover'||action==='reverify')void recover('all',true);
  if(action==='recover-hash')void recoverHash();
  if(action==='wallet-audit')auditWallet();
},islandLevel);
function enqueue(...commands:Command[]):void {for(const command of commands)input.enqueue(command);}
let tapFrom:{siteId:string;endpoint:RepairEndpoint}|null=null;
function action(action:RepairPanelAction):void {
  const snapshot=world.snapshot(),site=snapshot.sites.find((s)=>s.id===snapshot.inspectionId);if(!site?.draft)return;
  const slotFor=(partId:string)=>site.draft!.artifact.parts.find((p)=>p.id===partId)?.slotId;
  if(['placePart','setSetting','rotatePart','join'].includes(action.type))audio.play('snap');
  if(action.type==='selectTab')enqueue({kind:'Tab',tab:action.tab});
  if(action.type==='selectSlot')enqueue({kind:'SelectSlot',slotId:action.slotId});
  if(action.type==='selectPart')enqueue({kind:'SelectOption',optionId:action.optionId});
  if(action.type==='removePart')enqueue({kind:'SelectSlot',slotId:action.slotId},{kind:'RemovePart'});
  // Tap a port, then the port it feeds: the second tap joins them.
  if(action.type==='tapPort') {
    // The first tap is remembered here, not read back from the world, so a quick second tap or a
    // leftover selection can never misfire: tap one port, then the port it feeds, and they join.
    const held=tapFrom&&tapFrom.siteId===site.id?tapFrom.endpoint:null,again=held&&held.partId===action.endpoint.partId&&held.portId===action.endpoint.portId;
    if(held&&!again){enqueue({kind:'FocusPort',role:'source',endpoint:held},{kind:'FocusPort',role:'target',endpoint:action.endpoint},{kind:'JoinPorts'});tapFrom=null;}
    else{tapFrom={siteId:site.id,endpoint:action.endpoint};enqueue({kind:'FocusPort',role:'source',endpoint:action.endpoint});}
  }
  if(action.type!=='tapPort'&&action.type!=='selectSlot')tapFrom=null;
  if(action.type==='placePart')enqueue({kind:'SelectSlot',slotId:action.slotId},{kind:'SelectOption',optionId:action.optionId},{kind:'PlacePart'});
  if(action.type==='rotatePart'){const slot=slotFor(action.partId);if(slot){enqueue({kind:'SelectSlot',slotId:slot});for(let i=0;i<(action.quarterTurns===1?1:3);i++)enqueue({kind:'RotatePart'});}}
  if(action.type==='setSetting')enqueue({kind:'SetSetting',partId:action.partId,settingId:action.settingId});
  if(action.type==='setConfig')enqueue({kind:'SetConfiguration',field:action.field,value:action.value});
  if(action.type==='focusPort')enqueue({kind:'FocusPort',role:action.role,endpoint:action.endpoint});
  if(action.type==='join'||action.type==='removeConnection')enqueue({kind:'FocusPort',role:'source',endpoint:action.connection.from},{kind:'FocusPort',role:'target',endpoint:action.connection.to},{kind:action.type==='join'?'JoinPorts':'RemoveConnection'});
  if(action.type==='test')enqueue({kind:'TestDraft'});
  if(action.type==='openRationale')enqueue({kind:'Rationale'});
  if(action.type==='editRationale')enqueue({kind:'EditRationale',text:action.value});
  if(action.type==='review')enqueue({kind:'Review'});
  if(action.type==='openFeedback')enqueue({kind:'Feedback'});
  if(action.type==='back')enqueue({kind:'Back'});
  if(action.type==='exit')enqueue({kind:'Exit'});
  if(action.type==='submit') {
    if(snapshot.mode==='practice'){enqueue({kind:'ConfirmPractice'});return;}
    const session=currentSession(),markers=session?uncertainty.read(session.context):{uncertain:false,prepared:[]};
    const sitePending=!!session&&boundTickets(adapter,session,savedTickets()).some(ticket=>ticket.prepared.siteId===site.id);
    const siteUncertain=markers.uncertain&&(!markers.prepared.length||markers.prepared.some(prepared=>prepared.siteId===site.id));
    if(snapshot.editor?.stage!=='review'||!submissionAvailable(adapterState,world.context,sessionWallet,operationBusy,sitePending,siteUncertain,site.id)){actionNotice=operationBusy?'Your wallet progress is being checked. Keep this build open and try Submit when the check finishes.':'This repair still has an unfinished wallet request. Its original review is being checked automatically.';return;}
    if(!world.context)return;
    const owning:SubmissionSession={owner:world,context:Object.freeze({...world.context}),epoch:sessionEpoch};operationBusy=true;reviewSession=owning;
    void submitRepair(adapter,site.draft,owning,currentSession,(prepared)=>{uncertainty.mark(owning.context,prepared);inFlightPrepared=prepared;refreshRecovery();}).catch((error:unknown)=>{if(sameSession(owning,currentSession()))actionNotice=error instanceof Error?error.message:'Preparation failed. No restoration granted.';}).finally(()=>{inFlightPrepared=null;if(sameSession(owning,currentSession())){operationBusy=false;refreshRecovery();}});
  }
}
const panel=new RepairPanel(interfaceHost,action);
let dependencyStatusKey='',dependencyStatusReadAt=0,dependencyStatusRequest=0;
function updateDependencyStatus(snapshot:WorldSnapshot,time:number):void {
  const session=currentSession(),siteId=snapshot.inspectionId;
  if(!session||!siteId){
    if(dependencyStatusKey)panel.setDependencyStatus(null);
    dependencyStatusKey='';dependencyStatusReadAt=0;dependencyStatusRequest++;
    return;
  }
  const fixture=getRepairScenario(siteId),approvedParents=fixture.requires.filter(parent=>snapshot.restoredSiteIds.includes(parent));
  const key=`${session.context.caller.toLowerCase()}:${session.context.expeditionId}:${siteId}:${approvedParents.join(',')}`;
  if(key!==dependencyStatusKey){dependencyStatusKey=key;dependencyStatusReadAt=0;panel.setDependencyStatus(null);}
  // Re-read at a modest interval while inspecting so finalized async notices
  // appear without navigation, while avoiding an RPC on every render frame.
  if(time-dependencyStatusReadAt<10000)return;
  dependencyStatusReadAt=time;
  const request=++dependencyStatusRequest;
  void adapter.getSiteProgress(session.context.caller,siteId).then(progress=>{
    const live=currentSession();
    if(request!==dependencyStatusRequest||!live||!sameSession(session,live)||world.snapshot().inspectionId!==siteId)return;
    panel.setDependencyStatus({siteId,ready:progress.dependencyReady,required:progress.requiredParentSiteIds,
      confirmed:progress.confirmedParentSiteIds,approvedParents});
  }).catch(()=>{
    // An RPC/protocol error is not evidence of either approval or rejection.
    if(request===dependencyStatusRequest)panel.setDependencyStatus(null);
  });
}
function hasPreviousConnectedExpedition():boolean {
  const session=currentSession();if(!session)return false;
  try{return previousExpeditionId(localStorage,expeditionStorageKey(session.context.chainId,session.context.contractAddress,session.context.caller,FIXTURE_VERSION))!==null;}
  catch{return false;}
}
// Each site's council of five. Display only; while one holds the screen the restorer stays put.
const council=new CouncilReveal(interfaceHost,()=>renderer.councilStage?.()??null);
const unsubscribe=adapter.subscribe((state)=>{
  // The review's story (leader sentence, real votes) for that site's council; never an approval source.
  const story=councilDecisionFor(state);
  if(story&&reviewSession&&sameSession(reviewSession,currentSession()))council.setDecision(story);
  if(reviewSession&&sameSession(reviewSession,currentSession())) {
    try {
      if(state.status==='wallet-rejected'&&inFlightPrepared)uncertainty.resolveVerified(reviewSession.context,inFlightPrepared.nonce,inFlightPrepared.digest);
      if(state.status==='finalized-success')uncertainty.resolveVerified(reviewSession.context,state.grant.receipt.nonce,state.grant.receipt.digest);
      if(state.status==='rejected'||state.status==='failed'&&(state.reason==='execution'||state.reason==='no-majority'))uncertainty.resolveVerified(reviewSession.context,state.ticket.prepared.nonce,state.ticket.prepared.digest);
    }catch{actionNotice='Verification succeeded but its uncertainty latch could not be updated. Retry read-only recovery or explicitly check wallet activity.';}
    if(state.status==='network-error'||state.status==='recovery-needed'||state.status==='wallet-rejected'||state.status==='timed-out')actionNotice=state.message;
  }
  if(state.status==='disconnected'||state.status==='wrong-network'||state.status==='disabled') {sessionEpoch++;sessionWallet=null;reviewSession=null;recoveryController?.abort();if(!connecting)operationBusy=false;council.close();}
  if(state.status==='ready'){if(sessionWallet&&sessionWallet.toLowerCase()!==state.wallet.toLowerCase())sessionEpoch++;sessionWallet=state.wallet;}
  adapterState=state;
  if(reviewSession&&sameSession(reviewSession,currentSession()))world.enqueueReview(state);
  refreshRecovery();
});
function panelModel(snapshot:WorldSnapshot):RepairPanelModel {
  const site=snapshot.sites.find((s)=>s.id===snapshot.inspectionId),editor=snapshot.editor;
  const anchors=renderer.hitAnchors().filter((anchor)=>anchor.view==='inset'&&anchor.visible).map((anchor)=>({x:anchor.x-panel.layout.inset.x,y:anchor.y-panel.layout.inset.y,...(anchor.kind==='socket'?{slotId:anchor.slotId}:{endpoint:anchor.endpoint!})}));
  return {fixture:site?getRepairScenario(site.id):null,draft:site?.draft??null,selectedSlot:editor?.slotId??null,selectedOption:editor?.optionId??null,activeTab:editor?.tab??'parts',view:editor?.stage??'closed',mode:snapshot.mode,
    diagnosis:site?.feedback||siteCopy(site?.id??'')?.goal||'',status:{phase:site?.phase==='pending'?snapshot.reviewStatus:site?.testSeconds?'testing':snapshot.mode==='connected'&&operationBusy?(adapterState.status==='ready'?'queued':adapterState.status):'editing',message:site?.phase==='restored'?(snapshot.mode==='practice'?'Repaired with local rules. You can inspect this completed design.':'Final approval verified. You can inspect this completed design.'):operationBusy&&site?.phase==='damaged'?'Another connected operation is running. This design remains editable; a new submission must wait.':site?.feedback??''},
    advisory:site?.advice??null,sourcePort:editor?.from??null,targetPort:editor?.to??null,anchors,readOnly:!!site&&['pending','restoring','restored'].includes(site.phase)};
}
function resize():void {panel.resize(host.clientWidth,host.clientHeight);renderer.resize(host.clientWidth,host.clientHeight,Math.min(window.innerWidth<900?1.5:2,window.devicePixelRatio));}
try {
  renderer.initialize(host,islandLevel);resize();window.addEventListener('resize',resize);
  host.addEventListener('pointerup',(event)=>{
    if(!started||world.snapshot().paused)return;
    const rect=host.getBoundingClientRect(),id=renderer.pick({x:(event.clientX-rect.left)/rect.width*2-1,y:1-(event.clientY-rect.top)/rect.height*2});
    if(id?.startsWith('socket:')) {
      const [,siteId,slotId]=id.split(':');if(siteId!==world.snapshot().inspectionId||!slotId)return;
      const choice=world.snapshot().editor?.optionId;
      if(choice&&!getRepairScenario(siteId).options.find((option)=>option.id===choice)?.allowedSlots?.includes(slotId)){actionNotice='That stock does not fit this socket. The selected part remains held; choose a compatible socket.';return;}
      enqueue({kind:'SelectSlot',slotId});if(choice)enqueue({kind:'SelectOption',optionId:choice},{kind:'PlacePart'});
    }else if(id?.startsWith('port:')) {
      const [,siteId,partId,portId]=id.split(':');if(siteId===world.snapshot().inspectionId&&partId&&portId){action({type:'tapPort',endpoint:{partId,portId}});}
    }else if(id===world.snapshot().focusId)enqueue({kind:'Inspect'});
    else if(id&&!world.snapshot().inspectionId){const far=world.snapshot().sites.find(site=>site.id===id);if(far)actionNotice=`Walk up to the ${far.title}, then press E or tap Interact to work on it.`;}
  });
  const frame=(time:number)=> {
    const elapsed=(time-previousTime)/1000;previousTime=time;
    const step=clock.advance(elapsed,(dt)=>{const commands=input.sample();if(started)world.tick(dt,council.active?[]:commands);});
    {const now=world.snapshot();tutorial.update(now,started);council.observe(now);council.frame(elapsed,started?{x:now.player.position.x,z:now.player.position.z}:null,!started||now.paused||!!now.inspectionId);}
    const snapshot=world.snapshot();input.setContext(snapshot);updateDependencyStatus(snapshot,time);
    if(snapshot.mode==='connected'&&snapshot.revision!==lastRecoveryRevision)refreshRecovery();
    if(liveRecoveryNotice&&actionNotice===liveRecoveryNotice){const next=recoverySummary();if(next!==liveRecoveryNotice)actionNotice=liveRecoveryNotice=next;}else liveRecoveryNotice='';
    if(currentSession()&&!operationBusy&&!snapshot.paused&&time>=nextRecoveryAt&&(reviewCount>0||approvalCount>0)) {
      nextRecoveryAt=time+15000;void recover('all');
    }
    // Arrange from current state first. Render, picking and projected targets
    // share the exact inset/protected region, including soft-keyboard mode.
    panel.update(panelModel(snapshot));renderer.render(snapshot,{alpha:step.alpha,elapsedSeconds:elapsed,repairLayout:panel.layout,overview:!started});
    panel.update(panelModel(snapshot));hud.update(snapshot,started,actionNotice||saveNotice,hasSave,hasPreviousPractice);
    const objective=nextObjective(snapshot);hud.setObjectiveAnchor(objective?renderer.objectiveAnchor(objective.id):null,objective?.title??'');
    audio.update(snapshot,world,elapsed);host.dataset.audio=JSON.stringify(audio.diagnostics());
    hud.setConnection({enabled:config.enabled,walletAvailable:!!(window as unknown as {ethereum?:InjectedProvider}).ethereum,busy:operationBusy,sessionActive:!!currentSession(),reviewCount,approvalCount,uncertain,previousExpedition:hasPreviousConnectedExpedition()});
    document.body.classList.toggle('playing',started);document.body.classList.toggle('inspecting',!!snapshot.inspectionId);
    host.dataset.playerX=String(snapshot.player.position.x);host.dataset.playerY=String(snapshot.player.position.y);host.dataset.playerZ=String(snapshot.player.position.z);host.dataset.tick=String(snapshot.tick);host.dataset.focus=snapshot.focusId??'';host.dataset.inspection=snapshot.inspectionId??'';host.dataset.siteCount=String(snapshot.sites.length);host.dataset.paused=String(snapshot.paused);host.dataset.ending=String(snapshot.ending);host.dataset.started=String(started);
    // Read-only capture evidence. No teleport, completion setters or seeded
    // route are exposed; every screenshot must come from actual inputs.
    host.dataset.domainState=JSON.stringify(snapshot);host.dataset.hitAnchors=JSON.stringify(renderer.hitAnchors());host.dataset.repairLayout=JSON.stringify({planned:repairRegions(host.clientWidth,host.clientHeight),actual:panel.layout});
    if(started&&(snapshot.revision!==lastSavedRevision||time-lastCheckpoint>2000)){save();lastCheckpoint=time;}
    request=requestAnimationFrame(frame);
  };
  request=requestAnimationFrame(frame);
}catch(error){host.dataset.renderer='failed';throw error;}
window.addEventListener('pagehide',()=>{save();recoveryController?.abort();cancelAnimationFrame(request);window.removeEventListener('resize',resize);window.removeEventListener('island:new-connected-expedition',startNewConnectedExpedition);window.removeEventListener('island:retry-dependency-notification',retryDependencyNotification);input.dispose();panel.dispose();hud.dispose();audio.dispose();unsubscribe();adapter.dispose();renderer.dispose();},{once:true});
