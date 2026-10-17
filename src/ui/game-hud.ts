import type { WorldSnapshot } from '../domain/world';
import { SITE_PLAN } from '../content/site-plan';
import { ROUTES } from '../content/island-level';
import { MODE_COPY,PLAYER_COPY,siteCopy,GENLAYER_BETA_NOTICE } from './player-copy';
import type {LevelData} from '../domain/terrain';
import { nextObjective, objectiveWaitLabel, REPAIR_OUTCOMES } from './quest-guide';
export type HudAction='start'|'continue'|'previous'|'pause'|'save'|'replay'|'style'|'measure'|'mute'|'connected'|'recover'|'reverify'|'recover-hash'|'wallet-audit'|'tutorial';
export interface ConnectionHudModel {readonly enabled:boolean;readonly walletAvailable:boolean;readonly busy:boolean;readonly sessionActive:boolean;readonly reviewCount:number;readonly approvalCount:number;readonly uncertain:boolean;
  /** A previous connected expedition is saved on this browser (omit when unknown: the button still shows). */
  readonly previousExpedition?:boolean}
export function completedExpeditionMessage(snapshot:Pick<WorldSnapshot,'sites'|'restoredSiteIds'>):string|null {
  return snapshot.sites.length===8&&snapshot.sites.every(site=>snapshot.restoredSiteIds.includes(site.id))
    ?'All eight repairs complete. Explore freely or replay.':null;
}
export function routineSaveNotice(notice:string):boolean {
  return notice==='Local practice saved'||notice==='Caller-bound drafts and recovery tickets saved';
}
export class GameHud {
  private readonly root=document.createElement('section');
  private readonly mode=document.createElement('p');private readonly diagnosis=document.createElement('p');
  private readonly prompt=document.createElement('p');private readonly status=document.createElement('p');
  private readonly menu=document.createElement('section');private readonly title=document.createElement('h1');
  private readonly intro=document.createElement('p');private readonly start:HTMLButtonElement;private readonly resume:HTMLButtonElement;
  private readonly previousPractice:HTMLButtonElement;
  private readonly connected:HTMLButtonElement;private readonly tutorialButton:HTMLButtonElement;private readonly recover:HTMLButtonElement;private readonly reverify:HTMLButtonElement;
  private readonly recoverHash:HTMLButtonElement;private readonly audit:HTMLButtonElement;
  // Connected expeditions: start a fresh run (after an explicit confirmation) or return to the previous one.
  private readonly expedition=document.createElement('div');private readonly newExpedition=document.createElement('button');
  private readonly resumeExpedition=document.createElement('button');private readonly confirmExpedition=document.createElement('div');
  private readonly expeditionNote=document.createElement('p');
  private readonly endingNote=document.createElement('p');
  // While a repair is open the corner status is hidden (it would sit on the build view), so a notice
  // that arrives during the repair (a failed read before signing, a wallet refusal) shows here instead.
  private readonly repairNotice=document.createElement('div');private readonly repairNoticeText=document.createElement('span');
  private repairNoticeBaseline:string|null=null;private repairNoticeDismissed='';
  private readonly quests=document.createElement('details');private readonly questSummary=document.createElement('summary');
  private readonly questList=document.createElement('ol');private questStamp='';
  private readonly objective=document.createElement('div');
  private readonly map=document.createElementNS('http://www.w3.org/2000/svg','svg');
  private readonly player=document.createElementNS('http://www.w3.org/2000/svg','circle');
  private readonly markers=new Map<string,SVGCircleElement>();private readonly controls=document.createElement('nav');
  private readonly ending=document.createElement('section');private readonly endingList=document.createElement('ol');private readonly cleanups:(()=>void)[]=[];
  constructor(host:HTMLElement,private readonly onAction:(action:HudAction)=>void,level?:LevelData) {
    this.root.className='game-hud';this.mode.id='mode';this.diagnosis.id='diagnosis';this.prompt.id='prompt';this.status.id='save-status';
    this.diagnosis.setAttribute('role','status');this.prompt.setAttribute('aria-live','polite');
    this.root.append(this.mode,this.diagnosis,this.prompt,this.status);
    const button=(label:string,action:HudAction,id:string)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.id=id;const click=()=>onAction(action);b.addEventListener('click',click);this.cleanups.push(()=>b.removeEventListener('click',click));return b;};
    this.controls.className='general-controls';this.controls.append(button('Pause','pause','pause'),button('Save','save','save'),button('Cool lighting','style','style-toggle'),button('Measure framing','measure','measure'),button('Sound: off','mute','mute'));
    this.quests.className='island-quests';this.quests.append(this.questSummary,this.questList);
    this.questSummary.setAttribute('aria-label','Next objective and repair checklist');
    this.objective.className='objective-marker';this.objective.setAttribute('aria-hidden','true');
    this.menu.className='expedition-menu';this.menu.setAttribute('aria-label','Expedition menu');this.title.textContent=PLAYER_COPY.title;
    this.intro.textContent=`${PLAYER_COPY.intro} Repair water, power, transport equipment and wildlife habitats.`;
    this.start=button(PLAYER_COPY.start,'start','start-practice');this.resume=button(PLAYER_COPY.continue,'continue','continue');
    this.previousPractice=button('Resume previous practice game','previous','previous-practice');this.previousPractice.hidden=true;
    this.connected=button('Connected mode unavailable','connected','connected');
    this.tutorialButton=button('Play the tutorial','tutorial','play-tutorial');this.tutorialButton.className='tutorial-link';
    this.recover=button('Resume saved reviews','recover','recover-reviews');this.reverify=button('Reverify saved approvals','reverify','reverify-approvals');
    this.recoverHash=button('Recover original hash','recover-hash','recover-hash');this.audit=button('Wallet activity check','wallet-audit','wallet-audit');
    this.recover.hidden=this.reverify.hidden=true;
    const help=document.createElement('p');help.textContent=`${PLAYER_COPY.controls}. ${PLAYER_COPY.touchControls}`;
    const modeDetail=document.createElement('p');modeDetail.className='production-mode-detail';modeDetail.textContent=MODE_COPY.practice.detail;
    const betaNotice=document.createElement('p');betaNotice.className='production-mode-detail';betaNotice.textContent=GENLAYER_BETA_NOTICE;
    this.menu.append(this.title,this.intro,modeDetail,this.start,this.resume,this.previousPractice,this.connected,this.tutorialButton,betaNotice,help);
    this.controls.append(this.recover,this.reverify,this.recoverHash,this.audit);
    this.expedition.className='connected-expedition';this.expedition.hidden=true;
    for(const [b,label,id] of [[this.newExpedition,'Start a new connected expedition','new-expedition'],[this.resumeExpedition,'Resume previous connected expedition','resume-expedition']] as const){b.type='button';b.textContent=label;b.id=id;b.dataset.key=id;}
    this.expeditionNote.className='expedition-note';
    const confirmText=document.createElement('p');
    confirmText.textContent='Start a fresh connected expedition? Your current run stays saved here and on-chain, and you can resume it later. Its approvals will not unlock the new run.';
    const yes=document.createElement('button'),no=document.createElement('button');
    yes.type=no.type='button';yes.textContent='Start new expedition';no.textContent='Keep this expedition';yes.id='confirm-new-expedition';yes.dataset.key='confirm-new-expedition';no.dataset.key='cancel-new-expedition';
    yes.className='primary';
    this.confirmExpedition.className='expedition-confirm';this.confirmExpedition.setAttribute('role','alertdialog');this.confirmExpedition.hidden=true;
    const row=document.createElement('div');row.className='expedition-confirm-row';row.append(yes,no);this.confirmExpedition.append(confirmText,row);
    this.newExpedition.addEventListener('click',()=>{this.confirmExpedition.hidden=false;yes.focus();});
    no.addEventListener('click',()=>{this.confirmExpedition.hidden=true;this.newExpedition.focus();});
    // The app owns the reset: it refuses while a review is unresolved and never deletes the old run's save.
    yes.addEventListener('click',()=>{this.confirmExpedition.hidden=true;window.dispatchEvent(new CustomEvent('island:new-connected-expedition'));});
    this.resumeExpedition.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('island:resume-previous-connected-expedition')));
    this.expedition.append(this.newExpedition,this.resumeExpedition,this.confirmExpedition,this.expeditionNote);
    this.menu.insertBefore(this.expedition,this.connected.nextSibling);
    this.map.id='minimap';this.map.setAttribute('viewBox','-64 -64 128 128');this.map.setAttribute('aria-label','Island paths and repair sites');
    if(level?.sitePositions){const b=level.bounds;this.map.setAttribute('viewBox',`${b.minX-3} ${b.minZ-3} ${b.maxX-b.minX+6} ${b.maxZ-b.minZ+6}`);const land=document.createElementNS(this.map.namespaceURI,'path');land.setAttribute('d',level.triangles.map(t=>`M${t.a.x},${t.a.z}L${t.b.x},${t.b.z}L${t.c.x},${t.c.z}Z`).join(''));land.setAttribute('fill','#bbcba0');this.map.append(land);}
    else for(const route of ROUTES){const path=document.createElementNS(this.map.namespaceURI,'polyline');path.setAttribute('points',route.nodes.map((p)=>`${p.x},${p.z}`).join(' '));path.setAttribute('class','map-route');this.map.append(path);}
    for(const site of SITE_PLAN){const p=level?.sitePositions?.[site.id]??site.position,mark=document.createElementNS(this.map.namespaceURI,'circle')as SVGCircleElement;mark.setAttribute('cx',String(p.x));mark.setAttribute('cy',String(p.z));mark.setAttribute('r',level?.sitePositions?'1.5':'2.6');mark.setAttribute('class','map-site');const title=document.createElementNS(this.map.namespaceURI,'title');title.textContent=site.title;mark.append(title);this.markers.set(site.id,mark);this.map.append(mark);}
    this.player.setAttribute('r','2');this.player.setAttribute('class','map-player');this.map.append(this.player);
    this.ending.className='ending-journal';this.ending.hidden=true;const endingTitle=document.createElement('h2');endingTitle.textContent='The island is working again';
    const journal=document.createElement('details'),journalTitle=document.createElement('summary');
    journalTitle.textContent='View the eight repaired systems';journal.append(journalTitle,this.endingList);
    this.ending.append(endingTitle,this.endingNote,journal,button('Replay local expedition','replay','replay'));
    this.repairNotice.className='repair-notice';this.repairNotice.setAttribute('role','status');this.repairNotice.setAttribute('aria-live','polite');this.repairNotice.hidden=true;
    const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='repair-notice-dismiss';dismiss.textContent='×';dismiss.setAttribute('aria-label','Dismiss message');dismiss.dataset.key='dismiss-repair-notice';
    dismiss.addEventListener('click',()=>{this.repairNoticeDismissed=this.repairNoticeText.textContent??'';this.repairNotice.hidden=true;});
    this.repairNotice.append(this.repairNoticeText,dismiss);
    this.root.append(this.controls,this.map,this.quests,this.objective,this.menu,this.ending,this.repairNotice);host.append(this.root);
  }
  update(snapshot:WorldSnapshot,started:boolean,saveNotice:string,hasSave:boolean,hasPreviousPractice=false):void {
    const inspected=snapshot.sites.find((s)=>s.id===snapshot.inspectionId),focus=snapshot.sites.find((s)=>s.id===snapshot.focusId);
    this.root.classList.toggle('repair-open',!!inspected);this.root.classList.toggle('not-started',!started);
    this.mode.textContent=`${snapshot.mode==='practice'?'Local practice':'GenLayer testnet beta'} · ${snapshot.restoredSiteIds.length}/8 repaired`;
    this.diagnosis.textContent=inspected?inspected.feedback||siteCopy(inspected.id)?.goal||inspected.title:snapshot.routeDiagnosis||snapshot.notification;
    this.prompt.textContent=snapshot.paused?'Paused · Esc to continue':focus?`E / Interact · ${focus.title}`:'WASD / arrows to explore · E to inspect';
    this.status.textContent=saveNotice;this.status.classList.toggle('routine-save',routineSaveNotice(saveNotice));
    // Only notices that change while this repair is open: stale exploration messages stay out of the build view.
    if(!inspected)this.repairNoticeBaseline=null;else if(this.repairNoticeBaseline===null)this.repairNoticeBaseline=saveNotice;
    const fresh=!!inspected&&!!saveNotice&&saveNotice!==this.repairNoticeBaseline&&!routineSaveNotice(saveNotice)&&saveNotice!==this.repairNoticeDismissed;
    if(this.repairNoticeText.textContent!==saveNotice)this.repairNoticeText.textContent=saveNotice;
    this.repairNotice.hidden=!fresh;this.menu.hidden=started&&!snapshot.paused;
    this.start.hidden=started&&!snapshot.paused;this.start.textContent=started||hasSave?'Start new practice game':PLAYER_COPY.start;
    this.resume.hidden=started?!snapshot.paused:!hasSave;this.resume.textContent=started?'Resume game':'Continue saved practice game';
    this.previousPractice.hidden=!hasPreviousPractice;
    const next=nextObjective(snapshot),distance=next?Math.round(Math.hypot(next.position.x-snapshot.player.position.x,next.position.z-snapshot.player.position.z)):0;
    this.quests.hidden=!started||snapshot.paused||!!inspected||snapshot.ending;
    this.objective.hidden=this.quests.hidden||!next;
    this.questSummary.textContent=next?`Next: ${next.title} · ${distance} m`:`Journal · ${objectiveWaitLabel(snapshot)}`;
    const questStamp=JSON.stringify([snapshot.restoredSiteIds,snapshot.sites.map(site=>site.phase),next?.id]);
    if(questStamp!==this.questStamp){this.questStamp=questStamp;this.questList.replaceChildren();for(const site of snapshot.sites){const item=document.createElement('li');const available=site.requires.every(id=>snapshot.restoredSiteIds.includes(id));item.textContent=`${site.phase==='restored'?'✓':site.id===next?.id?'→':available?'○':'◇'} ${site.title} · ${site.phase==='restored'?'repaired':site.phase==='pending'?'in review':site.phase==='restoring'?'installing':available?'ready':'needs earlier repairs'}`;this.questList.append(item);}}
    const completedMessage=completedExpeditionMessage(snapshot);
    if(completedMessage)this.diagnosis.textContent=completedMessage;
    else {
      const landing=snapshot.sites.find(site=>site.id==='pier_hoist');
      if(!inspected&&!landing?.discovered&&!snapshot.restoredSiteIds.length&&!snapshot.routeDiagnosis)this.diagnosis.textContent='Inspect the Landing Hoist to begin. Explore freely.';
      if(!inspected&&landing?.phase==='restoring')this.diagnosis.textContent=snapshot.mode==='practice'?'Crew installing the local repair. Keep exploring.':'Verified repair being installed. Keep exploring.';
      if(!inspected&&snapshot.restoredSiteIds.includes('pier_hoist')&&snapshot.notification==='Inspect the storm damage. Three coastal jobs are open.')this.diagnosis.textContent=`Cargo secured. ${next?`Next: ${next.title}.`:'Explore the remaining repairs.'}`;
      if(!inspected)for(const site of snapshot.sites)if(snapshot.notification.startsWith(`${site.title} restored.`))this.diagnosis.textContent=REPAIR_OUTCOMES[site.id]??`${site.title} repaired.`;
    }
    this.title.textContent=started?PLAYER_COPY.paused:PLAYER_COPY.title;this.intro.hidden=started;
    this.menu.querySelector<HTMLElement>('.production-mode-detail')!.textContent=MODE_COPY[snapshot.mode].detail;
    this.map.style.display=!!inspected||!started||snapshot.ending?'none':'';
    this.player.setAttribute('cx',String(snapshot.player.position.x));this.player.setAttribute('cy',String(snapshot.player.position.z));
    for(const site of snapshot.sites)this.markers.get(site.id)?.setAttribute('class',`map-site ${site.phase}${site.id===next?.id?' next-objective':''}`);
    this.ending.hidden=!snapshot.ending;
    this.endingNote.textContent=snapshot.mode==='practice'?PLAYER_COPY.practiceEnding:PLAYER_COPY.connectedEnding;
    if(snapshot.ending&&this.endingList.children.length===0)for(const site of SITE_PLAN){const li=document.createElement('li');li.textContent=`${site.title}: ${REPAIR_OUTCOMES[site.id]}`;this.endingList.append(li);}
    if(!snapshot.ending)this.endingList.replaceChildren();
  }
  /** Development only: show the menu as a given connected session would (display only, grants nothing). */
  private devConnection:Partial<ConnectionHudModel>|null=null;
  setConnection(input:ConnectionHudModel):void {
    if(import.meta.env.DEV&&!('__previewConnectedMenu' in window))Object.assign(window,{__previewConnectedMenu:(m:Partial<ConnectionHudModel>|null)=>{this.devConnection=m;}});
    const model:ConnectionHudModel=import.meta.env.DEV&&this.devConnection?{...input,...this.devConnection}:input;
    this.connected.disabled=!model.enabled||!model.walletAvailable||model.busy;
    this.connected.textContent=!model.enabled?'Connected mode unconfigured':!model.walletAvailable?'Injected wallet unavailable':model.busy?'Checking connected session…':model.sessionActive?'Reconnect original wallet':'Connect GenLayer';
    this.recover.hidden=!model.sessionActive||model.reviewCount===0;this.reverify.hidden=!model.sessionActive||model.approvalCount===0;
    this.recover.disabled=this.reverify.disabled=model.busy;
    this.recover.textContent=`Resume reviews (${model.reviewCount})`;this.reverify.textContent=`Reverify approvals (${model.approvalCount})`;
    this.recoverHash.hidden=this.audit.hidden=!model.sessionActive||!model.uncertain;this.recoverHash.disabled=this.audit.disabled=model.busy;
    // Expedition controls only matter in a live connected session; a new run waits for submitted reviews to settle.
    this.expedition.hidden=!model.sessionActive;
    const unsettled=model.reviewCount>0||model.uncertain;
    this.newExpedition.disabled=model.busy||unsettled;
    this.resumeExpedition.hidden=model.previousExpedition===false;this.resumeExpedition.disabled=model.busy;
    this.expeditionNote.textContent=unsettled?'Resolve your submitted reviews before starting a new expedition; they stay bound to this run.':'';
    if(this.newExpedition.disabled)this.confirmExpedition.hidden=true;
  }
  setStyleLabel(cool:boolean):void {this.controls.querySelector('#style-toggle')!.textContent=cool?'Warm lighting':'Cool lighting';}
  setObjectiveAnchor(anchor:{x:number;y:number}|null,title:string):void {
    if(!anchor){this.objective.style.display='none';return;}
    const x=Math.max(110,Math.min(window.innerWidth-130,anchor.x)),y=Math.max(window.innerWidth<1000?180:150,Math.min(window.innerHeight-95,anchor.y));
    const arrow=x!==anchor.x||y!==anchor.y?['→','↘','↓','↙','←','↖','↑','↗'][(Math.round(Math.atan2(anchor.y-window.innerHeight/2,anchor.x-window.innerWidth/2)/(Math.PI/4))+8)%8]:'↓';
    this.objective.style.display='';this.objective.textContent=`${arrow} ${title}`;this.objective.style.left=`${x}px`;this.objective.style.top=`${y}px`;
  }
  setMuteLabel(mute:boolean):void {const button=this.controls.querySelector('#mute')!;button.textContent=mute?'Sound: off':'Sound: on';button.setAttribute('aria-pressed',String(!mute));}
  dispose():void {for(const cleanup of this.cleanups)cleanup();this.root.remove();}
}
