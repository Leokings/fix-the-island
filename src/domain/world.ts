import { canonicalizeRepairArtifact, createInitialArtifact, createRepairArtifact, normalizeRationale, validateRepairLocally, siteContractAddress } from '../genlayer';
import type { Address, Mode, QuarterTurn, RepairArtifact, RepairDraft, RepairEndpoint, RepairState, RecoveryTicket, SiteFixture, LocalRepairAdvice, PreparedRepair } from '../genlayer';
import { consumeSiteCatalog } from '../content/site-plan';
import { dryStandingGround, sampleGround, traverse, type LevelData, type Vec3 } from './terrain';
import { parseDraftRationale,parseSave } from './save';
import { movementTick } from './motion';
import { wholeSentences } from './feedback-text';
export { cameraRelativeMove } from './motion';

export type ConstructionTab = 'parts' | 'configure' | 'connect';
export type Command =
  | Readonly<{kind:'Move';right:number;up:number;brisk:boolean}>
  | Readonly<{kind:'Inspect' | 'Pause' | 'Exit' | 'RotatePart' | 'SetDetent' | 'PlacePart' | 'RemovePart' | 'TestDraft' | 'Rationale' | 'Review' | 'Back' | 'Feedback' | 'ConfirmPractice' | 'JoinPorts' | 'RemoveConnection'}>
  | Readonly<{kind:'SelectSlot';slotId:string}>
  | Readonly<{kind:'SelectOption';optionId:string}>
  | Readonly<{kind:'Tab';tab:ConstructionTab}>
  | Readonly<{kind:'SelectPort';endpoint:RepairEndpoint}>
  | Readonly<{kind:'FocusPort';role:'source'|'target';endpoint:RepairEndpoint}>
  | Readonly<{kind:'SetSetting';partId:string;settingId:string}>
  | Readonly<{kind:'SetConfiguration';field:keyof RepairArtifact['configuration'];value:string}>
  | Readonly<{kind:'EditRationale';text:string}>
  | Readonly<{kind:'ConfigField';field:keyof RepairArtifact['configuration']}>
  | Readonly<{kind:'CycleConfiguration'}>;
export interface EditorSnapshot {
  readonly tab:ConstructionTab; readonly slotId:string; readonly optionId:string|null;
  readonly from:RepairEndpoint|null; readonly to:RepairEndpoint|null;
  readonly field:keyof RepairArtifact['configuration']; readonly stage:'construct'|'rationale'|'review'|'feedback'|'status';
}
export interface SiteSnapshot {
  readonly id:string; readonly title:string; readonly position:Vec3;
  readonly phase:'damaged'|'pending'|'revision'|'restoring'|'restored'; readonly draft:RepairDraft|null;
  readonly requires:readonly string[]; readonly catalogReady:boolean; readonly diagnostic:string|null;
  readonly discovered:boolean; readonly advice:LocalRepairAdvice|null; readonly testSeconds:number;
  readonly restorationSeconds:number; readonly crew:'none'|'working'|'paused'|'finishing';
  readonly ticket:RecoveryTicket|null; readonly feedback:string; readonly approvedArtifact:RepairArtifact|null;
}
export interface WorldSnapshot {
  readonly tick:number; readonly revision:number; readonly mode:Mode; readonly paused:boolean;
  readonly player:Readonly<{position:Vec3;previousPosition:Vec3;velocity:Vec3;heading:number;gaitPhase:number;surfaceId:string}>;
  readonly sites:readonly SiteSnapshot[]; readonly focusId:string|null; readonly inspectionId:string|null;
  readonly editor:EditorSnapshot|null; readonly reviewStatus:RepairState['status'];
  readonly restoredSiteIds:readonly string[]; readonly ending:boolean; readonly notification:string; readonly routeDiagnosis:string|null;
}
interface SiteRecord {
  id:string;title:string;position:Vec3;phase:SiteSnapshot['phase'];draft:RepairDraft|null;requires:readonly string[];
  catalogReady:boolean;diagnostic:string|null;discovered:boolean;advice:LocalRepairAdvice|null;testSeconds:number;
  restorationSeconds:number;crew:SiteSnapshot['crew'];ticket:RecoveryTicket|null;feedback:string;approvedArtifact:RepairArtifact|null;
}
export interface SaveData {
  readonly version:1; readonly levelId:string; readonly mode:Mode; readonly position:Vec3;
  readonly sites:readonly {id:string;discovered:boolean;draft:RepairDraft|null;completedArtifact:RepairArtifact|null;ticket:RecoveryTicket|null}[];
}
export interface ConnectedContext { readonly caller:Address; readonly expeditionId:import('../genlayer').Hash; readonly contractAddress:Address; readonly chainId:4221|61999; readonly siteAddresses?:Readonly<Record<string,Address>> }
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const sameFlags=(a:Readonly<Record<string,boolean>>,b:Readonly<Record<string,boolean>>)=>Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(key=>a[key]===b[key]);
const samePrepared=(a:PreparedRepair,b:PreparedRepair)=>a.caller===b.caller&&a.expeditionId===b.expeditionId&&a.siteId===b.siteId&&a.nonce===b.nonce&&a.digest===b.digest&&a.fixtureVersion===b.fixtureVersion&&a.rationale===b.rationale&&a.technicallyValid===b.technicallyValid&&sameFlags(a.technicalFlags,b.technicalFlags)&&canonicalizeRepairArtifact(a.artifact)===canonicalizeRepairArtifact(b.artifact);
/** How far each site's interaction reaches; the bridge spans the creek so it reaches further. */
export const focusRadius=(siteId:string):number=>siteId==='creek_bridge'?6.3:3.5;
/**
 * The site in focus: of the sites in range, the one the restorer is relatively deepest into
 * (distance / reach). Where two ranges overlap this picks the one you are walking toward,
 * not whichever comes first in the list.
 */
export function focusSite(sites:readonly Readonly<{id:string;position:Readonly<{x:number;z:number}>}>[],position:Readonly<{x:number;z:number}>):string|null {
  let best:string|null=null,bestDepth=1;
  for(const s of sites){const depth=Math.hypot(s.position.x-position.x,s.position.z-position.z)/focusRadius(s.id);if(depth<bestDepth){bestDepth=depth;best=s.id;}}
  return best;
}

export class World {
  private position:Vec3;private previousPosition:Vec3;private velocity:Vec3={x:0,y:0,z:0};
  private heading=0;private gaitPhase=0;private tickCount=0;private revision=0;private paused=false;
  private inspectionId:string|null=null;private focusId:string|null=null;private editor:EditorSnapshot|null=null;
  private reviewStatus:RepairState['status']='disabled';private notification='Inspect the storm damage. Three coastal jobs are open.';
  private readonly inbox:RepairState[]=[];private readonly sites:SiteRecord[];
  private readonly fixtures=new Map<string,SiteFixture>();private readonly restored=new Set<string>();
  // A deep-validated cache may suppress a repeated installation animation,
  // never the public grant checks or progression authority below.
  private readonly installedHints=new Map<string,RepairArtifact>();
  private savedResumePosition:Vec3|null=null;
  constructor(readonly level:LevelData,fixtures:readonly SiteFixture[],readonly mode:Mode='practice',readonly context:ConnectedContext|null=null) {
    const ground=sampleGround(level,level.spawn.x,level.spawn.z);if(!ground)throw new Error('Spawn has no authored dry surface');
    this.position={...level.spawn,y:ground.y};this.previousPosition=this.position;
    this.sites=consumeSiteCatalog(fixtures).map(({plan,fixture,diagnostic})=> {
      if(fixture)this.fixtures.set(plan.id,fixture);
      return {id:plan.id,title:plan.title,position:level.sitePositions?.[plan.id]??plan.position,requires:plan.requires,phase:'damaged',
        draft:fixture?Object.freeze({siteId:plan.id,artifact:createInitialArtifact(plan.id),rationale:''}):null,
        catalogReady:fixture!==null,diagnostic,discovered:false,advice:null,testSeconds:0,restorationSeconds:0,
        crew:'none',ticket:null,feedback:'',approvedArtifact:null};
    });
  }
  enqueueReview(state:RepairState):void {if(this.inbox.length===32)this.inbox.shift();this.inbox.push(state);}
  private edited(site:SiteRecord,artifact:RepairArtifact):void {
    site.draft=Object.freeze({...site.draft!,artifact});site.advice=null;site.testSeconds=0;site.feedback='';this.revision++;
  }
  private enter(site:SiteRecord):void {
    this.inspectionId=site.id;site.discovered=true;this.revision++;
    this.editor={tab:'parts',slotId:this.fixtures.get(site.id)?.slotIds[0]??'',optionId:null,from:null,to:null,field:'mountZoneId',stage:['pending','restoring','restored'].includes(site.phase)?'status':'construct'};
  }
  private missing(site:SiteRecord):string[] {return site.requires.filter((id)=>!this.restored.has(id));}
  private beginRestore(site:SiteRecord,artifact:RepairArtifact):void {
    if(site.phase==='restored'||site.phase==='restoring')return;
    site.approvedArtifact=artifact;site.phase='restoring';site.crew='finishing';site.restorationSeconds=0;
    if(this.inspectionId===site.id){this.inspectionId=null;this.editor=null;}this.revision++;
    this.notification=this.mode==='practice'?`${site.title}: local deterministic repair is being installed.`:`${site.title}: finalized approved construction is being installed.`;
  }
  private reconcile(state:RepairState):void {
    this.reviewStatus=state.status;
    if(this.mode!=='connected'||!this.context)return;
    const ticket='ticket'in state?state.ticket:null;
    const site=ticket?this.sites.find((s)=>s.id===ticket.prepared.siteId):state.status==='finalized-success'?this.sites.find((s)=>s.id===state.grant.receipt.siteId):null;
    if(!site)return;
    if(site.phase==='restored'||site.phase==='restoring')return;
    if(ticket) {
      if(ticket.chainId!==this.context.chainId||ticket.contractAddress.toLowerCase()!==siteContractAddress(this.context,site.id).toLowerCase()||ticket.prepared.caller.toLowerCase()!==this.context.caller.toLowerCase()||ticket.prepared.fixtureVersion!==this.fixtures.get(site.id)?.version)return;
      if(site.ticket&&!samePrepared(site.ticket.prepared,ticket.prepared)&&!(site.phase==='pending'&&site.crew==='none')&&!(site.phase==='revision'&&state.status==='submitted'))return;
      if(['submitted','pending','accepted','timed-out','finalized','recovery-needed'].includes(state.status)) {
        const firstSubmission=site.phase!=='pending'&&state.status==='submitted';
        site.ticket=ticket;site.draft=Object.freeze({siteId:site.id,artifact:ticket.prepared.artifact,rationale:ticket.prepared.rationale});site.phase='pending';site.crew='working';
        site.feedback=state.status==='accepted'?'Accepted provisionally. Still awaiting finalized execution and bound approval.':state.status==='timed-out'?'Polling stopped; this job remains pending and recoverable.':`Network status: ${state.status}. No restoration yet.`;
        if(firstSubmission&&this.inspectionId===site.id){this.inspectionId=null;this.editor=null;}this.revision++;
      }
      if(state.status==='rejected') {
        if(canonicalizeRepairArtifact(state.receipt.artifact)!==canonicalizeRepairArtifact(ticket.prepared.artifact)||state.receipt.digest!==ticket.prepared.digest||state.receipt.caller.toLowerCase()!==this.context.caller.toLowerCase())return;
        site.ticket=null;site.draft={siteId:site.id,artifact:state.receipt.artifact,rationale:state.receipt.rationale};
        site.phase='revision';site.crew='paused';site.feedback=wholeSentences(state.receipt.feedback);this.revision++;
      }
      if(state.status==='failed') {
        const terminal=['execution','no-majority','canceled'].includes(state.reason);
        site.ticket=terminal?null:ticket;site.phase=terminal?'revision':'pending';site.crew='paused';site.feedback=state.reason==='no-majority'?'The council was split. Make your plan more specific and submit again.':state.message;
        if(!site.discovered||site.phase==='pending')site.draft={siteId:site.id,artifact:ticket.prepared.artifact,rationale:ticket.prepared.rationale};
        if(terminal&&this.inspectionId===site.id&&this.editor)this.editor={...this.editor,stage:'construct'};
        this.revision++;
      }
    }
    if(state.status==='finalized-success'&&site.ticket) {
      const grant=state.grant,receipt=grant.receipt,prepared=site.ticket.prepared;
      const contextFlags=['groundedInArtifact','explainsTradeoff','protectsHabitat','safeUseAndMaintenance'];
      const technicalFlags=['schema','inventory','budget','connections','operation','dependencies','nonce','newSite'];
      if(grant.mode!=='connected'||grant.finality!=='FINALIZED'||grant.execution!=='SUCCEEDED'||grant.chainId!==this.context.chainId||grant.contractAddress.toLowerCase()!==siteContractAddress(this.context,site.id).toLowerCase()||
        !site.ticket.txId||!/^0x[0-9a-fA-F]{64}$/.test(site.ticket.txId)||grant.txId!==site.ticket.txId||
        !prepared.technicallyValid||technicalFlags.some((flag)=>receipt.technicalFlags[flag]!==true)||Object.values(receipt.technicalFlags).some((flag)=>flag!==true)||!sameFlags(receipt.technicalFlags,prepared.technicalFlags)||!receipt.contextFlags||Object.values(receipt.contextFlags).some((flag)=>flag!==true)||contextFlags.some((flag)=>receipt.contextFlags?.[flag]!==true)||
        receipt.decision!=='approved'||receipt.caller.toLowerCase()!==this.context.caller.toLowerCase()||receipt.nonce!==prepared.nonce||receipt.digest!==prepared.digest||receipt.fixtureVersion!==prepared.fixtureVersion||
        receipt.siteId!==prepared.siteId||receipt.rationale!==prepared.rationale||canonicalizeRepairArtifact(receipt.artifact)!==canonicalizeRepairArtifact(prepared.artifact)||this.missing(site).length)return;
      if(this.installedHints.has(site.id)&&canonicalizeRepairArtifact(this.installedHints.get(site.id)!)===canonicalizeRepairArtifact(receipt.artifact)) {
        site.approvedArtifact=receipt.artifact;site.phase='restored';site.crew='none';site.restorationSeconds=3;
        this.restored.add(site.id);this.installedHints.delete(site.id);this.revision++;
        this.notification=`${site.title}: original finalized approval reverified; completed installation retained.`;
      }else this.beginRestore(site,receipt.artifact);
    }
  }
  private construction(command:Command,site:SiteRecord):void {
    const fixture=this.fixtures.get(site.id),editor=this.editor,draft=site.draft;
    if(!fixture||!editor||!draft)return;
    if(command.kind==='Back') {this.editor={...editor,stage:'construct'};return;}
    if(command.kind==='Feedback') {this.editor={...editor,stage:'feedback'};return;}
    if(['pending','restoring','restored'].includes(site.phase))return;
    if(command.kind==='EditRationale'&&site.phase!=='pending'&&site.phase!=='restored') {
      try{site.draft=Object.freeze({...draft,rationale:parseDraftRationale(command.text)});this.revision++;}catch{site.feedback='Journal text must fit 800 Unicode scalars / 2 KiB without broken characters.';}return;
    }
    if(command.kind==='Rationale') {this.editor={...editor,stage:'rationale'};return;}
    if(command.kind==='Review') {
      try {normalizeRationale(draft.rationale);this.editor={...editor,stage:'review'};}catch(error){site.feedback=error instanceof Error?error.message:'Answer the council in one line of 15–200 characters.';}return;
    }
    if(command.kind==='ConfirmPractice') {
      if(this.mode!=='practice'||editor.stage!=='review'||this.level.id==='stage-a-coast-smoke')return;
      try {
        normalizeRationale(draft.rationale);
        const advice=validateRepairLocally(site.id,draft.artifact);site.advice=advice;
        if(!advice.valid||this.missing(site).length) {site.feedback=this.missing(site).length?'Restore the prerequisite equipment first.':advice.feedback.join(' ');return;}
        this.beginRestore(site,createRepairArtifact(draft.artifact,fixture));
      }catch(error){site.feedback=String(error);}return;
    }
    if(command.kind==='TestDraft') {
      site.advice=validateRepairLocally(site.id,draft.artifact);site.testSeconds=2.5;
      const missing=this.missing(site);
      site.feedback=missing.length?`Prerequisites: ${missing.map((id)=>this.sites.find((s)=>s.id===id)!.title).join(', ')}.`:
        site.advice.valid?'Technical test passed. Now answer the council in one line. This is advisory, not a connected approval.':site.advice.feedback.join(' ');
      return;
    }
    if(site.phase==='pending'||site.phase==='restoring'||site.phase==='restored')return;
    if(command.kind==='Tab') {this.editor={...editor,tab:command.tab,stage:'construct'};return;}
    if(command.kind==='SelectSlot'&&fixture.slotIds.includes(command.slotId)) {this.editor={...editor,slotId:command.slotId,optionId:null};return;}
    if(command.kind==='SelectOption'&&fixture.options.some((o)=>o.id===command.optionId&&o.allowedSlots?.includes(editor.slotId))) {this.editor={...editor,optionId:command.optionId};return;}
    const part=draft.artifact.parts.find((p)=>p.slotId===editor.slotId), option=fixture.options.find((o)=>o.id===part?.optionId);
    try {
      if(command.kind==='PlacePart'&&editor.optionId) {
        const next=fixture.options.find((o)=>o.id===editor.optionId)!;
        const parts=draft.artifact.parts.filter((p)=>p.slotId!==editor.slotId);
        parts.push({id:editor.slotId,slotId:editor.slotId,optionId:next.id,orientationQuarterTurns:0,settingId:next.allowedSettings?.[0]??'fixed'});
        const connections=draft.artifact.connections.filter((edge)=>edge.from.partId!==editor.slotId&&edge.to.partId!==editor.slotId);
        this.edited(site,createRepairArtifact({...draft.artifact,parts,connections},fixture));
        this.notification=`${next.label} snapped into ${editor.slotId.replaceAll('_',' ')}. Join its ports before testing.`;
      }
      if(command.kind==='RemovePart'&&part) this.edited(site,createRepairArtifact({...draft.artifact,parts:draft.artifact.parts.filter((p)=>p.id!==part.id),connections:draft.artifact.connections.filter((edge)=>edge.from.partId!==part.id&&edge.to.partId!==part.id)},fixture));
      if(command.kind==='RotatePart'&&part) this.edited(site,createRepairArtifact({...draft.artifact,parts:draft.artifact.parts.map((p)=>p===part?{...p,orientationQuarterTurns:(p.orientationQuarterTurns+1)%4 as QuarterTurn}:p)},fixture));
      if(command.kind==='SetDetent'&&part&&option) {
        const settings=option.allowedSettings??['fixed'],index=settings.indexOf(part.settingId);
        this.edited(site,createRepairArtifact({...draft.artifact,parts:draft.artifact.parts.map((p)=>p===part?{...p,settingId:settings[(index+1)%settings.length]!}:p)},fixture));
      }
      if(command.kind==='SetSetting') {
        const target=draft.artifact.parts.find((p)=>p.id===command.partId),stock=fixture.options.find((o)=>o.id===target?.optionId);
        if(target&&stock?.allowedSettings?.includes(command.settingId))this.edited(site,createRepairArtifact({...draft.artifact,parts:draft.artifact.parts.map((p)=>p===target?{...p,settingId:command.settingId}:p)},fixture));
      }
      if(command.kind==='SetConfiguration')this.edited(site,createRepairArtifact({...draft.artifact,configuration:{...draft.artifact.configuration,[command.field]:command.value}},fixture));
      if(command.kind==='ConfigField') this.editor={...editor,field:command.field};
      if(command.kind==='CycleConfiguration') {
        const names={mountZoneId:fixture.configurationOptions.mountZoneIds,outputModeId:fixture.configurationOptions.outputModeIds,routeId:fixture.configurationOptions.routeIds};
        const choices=names[editor.field],i=choices.indexOf(draft.artifact.configuration[editor.field]);
        this.edited(site,createRepairArtifact({...draft.artifact,configuration:{...draft.artifact.configuration,[editor.field]:choices[(i+1)%choices.length]}},fixture));
      }
      if(command.kind==='SelectPort') {
        const p=draft.artifact.parts.find((p)=>p.id===command.endpoint.partId),o=fixture.options.find((o)=>o.id===p?.optionId);
        if(o?.ports.some((port)=>port.id===command.endpoint.portId)) this.editor=!editor.from||editor.to?{...editor,from:command.endpoint,to:null}:{...editor,to:command.endpoint};
      }
      if(command.kind==='FocusPort') {
        const p=draft.artifact.parts.find((p)=>p.id===command.endpoint.partId),o=fixture.options.find((o)=>o.id===p?.optionId);
        if(o?.ports.some((port)=>port.id===command.endpoint.portId))this.editor=command.role==='source'?{...editor,from:command.endpoint,to:null}:{...editor,to:command.endpoint};
      }
      if(command.kind==='JoinPorts'&&editor.from&&editor.to) {
        let from=editor.from,to=editor.to;
        const port=(e:RepairEndpoint)=>fixture.options.find((o)=>o.id===draft.artifact.parts.find((p)=>p.id===e.partId)?.optionId)?.ports.find((p)=>p.id===e.portId);
        if(port(from)?.direction==='in'&&port(to)?.direction==='out') [from,to]=[to,from];
        const a=port(from),b=port(to);
        if(!a||!b||a.channel!==b.channel||a.direction==='in'||b.direction==='out'||from.partId===to.partId){site.feedback='Join a compatible output to an input of the same channel.';return;}
        const edge={channel:a.channel,from,to};
        if(!draft.artifact.connections.some((e)=>same(e,edge))) this.edited(site,createRepairArtifact({...draft.artifact,connections:[...draft.artifact.connections,edge]},fixture));
        this.editor={...editor,from:null,to:null};
      }
      if(command.kind==='RemoveConnection'&&editor.from&&editor.to) {
        this.edited(site,createRepairArtifact({...draft.artifact,connections:draft.artifact.connections.filter((edge)=>!(same(edge.from,editor.from)&&same(edge.to,editor.to))&&!(same(edge.to,editor.from)&&same(edge.from,editor.to)))},fixture));
        this.editor={...editor,from:null,to:null};
      }
    }catch(error){site.feedback=error instanceof Error?error.message:String(error);}
  }
  tick(dt:number,commands:readonly Command[]):void {
    let movement={right:0,up:0,brisk:false};
    for(const command of commands) {
      if(command.kind==='Move')movement=command;
      if(command.kind==='Pause') {if(this.inspectionId){this.inspectionId=null;this.editor=null;}else this.paused=!this.paused;}
      if(command.kind==='Exit') {this.inspectionId=null;this.editor=null;}
      if(command.kind==='Inspect'&&!this.paused&&this.focusId)this.enter(this.sites.find((s)=>s.id===this.focusId)!);
      if(!this.paused&&this.inspectionId)this.construction(command,this.sites.find((s)=>s.id===this.inspectionId)!);
    }
    this.previousPosition=this.position;
    if(this.paused){this.velocity={x:0,y:0,z:0};return;}
    while(this.inbox.length)this.reconcile(this.inbox.shift()!);
    if(this.inspectionId)this.velocity={x:0,y:0,z:0};
    else {
      if(movement.right!==0||movement.up!==0)this.savedResumePosition=null;
      const next=movementTick(this.level,{position:this.position,velocity:this.velocity},movement,dt,this.restored);
      this.velocity=next.velocity;this.position=next.position;
      const speed2d=Math.hypot(this.velocity.x,this.velocity.z);
      if(speed2d>0.01){this.heading=Math.atan2(this.velocity.x,this.velocity.z);this.gaitPhase=(this.gaitPhase+speed2d*dt*3.3)%(Math.PI*2);}
    }
    this.tickCount++;
    for(const site of this.sites) {
      site.testSeconds=Math.max(0,site.testSeconds-dt);
      if(site.phase==='restoring') {
        site.restorationSeconds+=dt;
        if(site.restorationSeconds>=3){site.phase='restored';site.crew='none';this.restored.add(site.id);this.revision++;this.notification=`${site.title} restored. ${consumeSiteCatalog([...this.fixtures.values()]).find((s)=>s.plan.id===site.id)!.plan.consequence}`;}
      }
    }
    this.focusId=focusSite(this.sites.filter((s)=>this.level.visibleSiteIds.includes(s.id)),this.position);
  }
  exportSave():SaveData {
    return {version:1,levelId:this.level.id,mode:this.mode,position:{...(this.savedResumePosition??this.position)},sites:this.sites.map((site)=>({id:site.id,discovered:site.discovered,draft:site.draft?{siteId:site.id,artifact:site.draft.artifact,rationale:site.draft.rationale}:null,completedArtifact:site.phase==='restored'?site.approvedArtifact:null,ticket:site.ticket}))};
  }
  resumeVerifiedPosition():void {
    if(!this.savedResumePosition)return;
    const ground=dryStandingGround(this.level,this.savedResumePosition,this.restored);
    if(!ground)return;
    this.position={...this.savedResumePosition,y:ground.y};this.previousPosition=this.position;this.savedResumePosition=null;this.revision++;
  }
  restoreSave(data:SaveData):void {
    // Parse all eight records before touching anything. A malformed last row
    // cannot leave partially restored routes behind after a caught failure.
    const migrated=this.level.saveCompatibleLevelIds?.includes(data.levelId)??false;
    const validated=parseSave(data,[...this.fixtures.values()],{mode:this.mode,levelId:this.level.id,context:this.context,...(this.level.saveCompatibleLevelIds?{compatibleLevelIds:this.level.saveCompatibleLevelIds}:{})});
    const safeSpawn=dryStandingGround(this.level,this.level.spawn);
    if(!safeSpawn)throw new Error('Level has no clear recovery spawn.');
    this.restored.clear();this.installedHints.clear();
    // Cache cannot confer connected authority. Local records still undergo
    // schema, deterministic and dependency checks before they restore paths.
    for(const site of this.sites) {
      const saved=validated.sites.find((s)=>s.id===site.id),fixture=this.fixtures.get(site.id);if(!saved||!fixture)continue;
      site.phase='damaged';site.crew='none';site.ticket=null;site.approvedArtifact=null;site.restorationSeconds=0;
      site.advice=null;site.feedback='';site.testSeconds=0;
      if(saved.draft)site.draft=Object.freeze({siteId:site.id,artifact:createRepairArtifact(saved.draft.artifact,fixture),rationale:saved.draft.rationale});
      site.discovered=saved.discovered;
      if(this.mode==='connected'&&saved.completedArtifact)this.installedHints.set(site.id,createRepairArtifact(saved.completedArtifact,fixture));
      let rationaleValid=false;
      try{if(saved.draft)normalizeRationale(saved.draft.rationale);rationaleValid=true;}catch{/* A corrupt completion remains damage, while its draft can be revised. */}
      if(this.mode==='practice'&&saved.completedArtifact&&saved.draft&&rationaleValid&&same(saved.completedArtifact,saved.draft.artifact)&&validateRepairLocally(site.id,saved.completedArtifact).valid&&!this.missing(site).length) {
        site.approvedArtifact=createRepairArtifact(saved.completedArtifact,fixture);site.phase='restored';site.restorationSeconds=3;this.restored.add(site.id);
      }
      if(this.mode==='connected'&&saved.ticket&&this.context&&saved.ticket.prepared?.siteId===site.id&&saved.ticket.prepared.caller?.toLowerCase()===this.context.caller.toLowerCase()&&saved.ticket.contractAddress?.toLowerCase()===siteContractAddress(this.context,site.id).toLowerCase()&&saved.ticket.chainId===this.context.chainId&&/^0x[0-9a-fA-F]{64}$/.test(saved.ticket.evmTxHash)) {
        site.ticket=saved.ticket;site.phase='pending';site.crew='none';site.feedback='Saved job requires public evidence reconciliation. No cached approval or worker activity is trusted.';
      }
    }
    const candidate=validated.position,ground=dryStandingGround(this.level,candidate,this.restored);
    this.savedResumePosition=this.mode==='connected'&&!migrated?{...candidate}:null;
    if(ground&&!migrated)this.position={...candidate,y:ground.y};
    else {this.position={...this.level.spawn,y:safeSpawn.y};this.notification=migrated?'Island layout changed: returned to the new landing. Drafts retained; connected approvals still require public reverification.':'Saved position was not dry and clear. Returned to the landing; drafts retained. Connected progress requires public reverification.';}
    this.previousPosition=this.position;this.velocity={x:0,y:0,z:0};this.inspectionId=null;this.editor=null;this.focusId=null;this.inbox.length=0;this.revision++;
  }
  snapshot():WorldSnapshot {
    const nearestGate=this.level.gates?.find((g)=>g.requires.some((id)=>!this.restored.has(id))&&Math.hypot(g.position.x-this.position.x,g.position.z-this.position.z)<5.0);
    return Object.freeze({tick:this.tickCount,revision:this.revision,mode:this.mode,paused:this.paused,
      player:Object.freeze({position:Object.freeze({...this.position}),previousPosition:Object.freeze({...this.previousPosition}),velocity:Object.freeze({...this.velocity}),heading:this.heading,gaitPhase:this.gaitPhase,surfaceId:sampleGround(this.level,this.position.x,this.position.z,this.restored)!.surfaceId}),
      sites:Object.freeze(this.sites.map((site)=>Object.freeze({...site}))),focusId:this.focusId,inspectionId:this.inspectionId,editor:this.editor?Object.freeze({...this.editor}):null,
      reviewStatus:this.reviewStatus,restoredSiteIds:Object.freeze([...this.restored]),ending:this.restored.size===8,notification:this.notification,routeDiagnosis:nearestGate?.diagnosis??null});
  }
}
