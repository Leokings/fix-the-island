import {describe,expect,it} from 'vitest';
import {createInitialArtifact,createRepairExampleDraft,FIXTURE_VERSION,REPAIR_SCENARIOS,validateRepairLocally} from '../../src/genlayer';
import type {Hash,RecoveryTicket,RepairState,RestorationGrant} from '../../src/genlayer';
import {World,type SaveData,type ConnectedContext} from '../../src/domain/world';
import {loadSave,parseRecoveryTicket,parseSave,saveKey} from '../../src/domain/save';
import {dryStandingGround,sampleGround,type LevelData} from '../../src/domain/terrain';
import {ISLAND_LEVEL} from '../../src/content/island-level';
import {SMOKE_LEVEL} from '../../src/content/smoke-level';
import {socketPosition} from '../../src/content/assembly-layout';
const dt=1/60;
const context:ConnectedContext={caller:'0x1111111111111111111111111111111111111111',expeditionId:'0x'+'d'.repeat(64) as Hash,contractAddress:'0x2222222222222222222222222222222222222222',chainId:4221,siteAddresses:Object.fromEntries(REPAIR_SCENARIOS.map(site=>[site.id,'0x2222222222222222222222222222222222222222']))};
const hash=(char:string)=>`0x${char.repeat(64)}` as Hash;
const technicalFlags={schema:true,inventory:true,budget:true,connections:true,operation:true,dependencies:true,nonce:true,newSite:true};
const contextFlags={groundedInArtifact:true,explainsTradeoff:true,protectsHabitat:true,safeUseAndMaintenance:true};
const example=createRepairExampleDraft('pier_hoist','valid'); // Unit fixtures only, never an input journey.
const ticket:RecoveryTicket={version:2,chainId:4221,contractAddress:context.contractAddress,evmTxHash:hash('a'),txId:hash('b'),prepared:{...example,caller:context.caller,expeditionId:context.expeditionId,nonce:'0',digest:hash('c'),fixtureVersion:FIXTURE_VERSION,technicalFlags,technicallyValid:true}};
const grant:RestorationGrant={mode:'connected',finality:'FINALIZED',execution:'SUCCEEDED',txId:ticket.txId!,evmTxHash:ticket.evmTxHash,contractAddress:context.contractAddress,chainId:4221,receipt:{...ticket.prepared,decision:'approved',contextFlags,feedback:'Fixture decision'}};
function connected():World {const world=new World(ISLAND_LEVEL,REPAIR_SCENARIOS,'connected',context);world.enqueueReview({status:'submitted',ticket});world.tick(dt,[]);return world;}
function clone<T>(value:T):T {return JSON.parse(JSON.stringify(value)) as T;}

describe('Stage B shared catalog and physical edits',()=>{
  for(const fixture of REPAIR_SCENARIOS)it(`${fixture.id}: every socket is mapped, initial fault is invalid and example is valid`,()=>{
    for(const slot of fixture.slotIds)expect(Object.values(socketPosition(fixture.id,slot)).every(Number.isFinite)).toBe(true);
    expect(validateRepairLocally(fixture.id,createInitialArtifact(fixture.id)).valid).toBe(false);
    expect(validateRepairLocally(fixture.id,createRepairExampleDraft(fixture.id,'valid').artifact).valid).toBe(true);
  });
  it('edits and installs a local hoist through commands, not a completed flag',()=>{
    const world=new World(ISLAND_LEVEL,REPAIR_SCENARIOS);
    for(let i=0;i<25;i++)world.tick(dt,[{kind:'Move',right:1,up:1,brisk:true}]);
    world.tick(dt,[{kind:'Inspect'},{kind:'SelectSlot',slotId:'rope'},{kind:'SelectOption',optionId:'rope_standard'},{kind:'PlacePart'}]);
    expect(world.snapshot().sites[0]!.draft!.artifact.connections.some((edge)=>edge.from.partId==='rope')).toBe(false);
    world.tick(dt,[{kind:'SetSetting',partId:'weight_b',settingId:'rail_1500'},{kind:'FocusPort',role:'source',endpoint:{partId:'rope',portId:'anchor'}},{kind:'FocusPort',role:'target',endpoint:{partId:'boom',portId:'anchor'}},{kind:'JoinPorts'},{kind:'TestDraft'}]);
    expect(world.snapshot().sites[0]!.advice?.valid).toBe(true);
    world.tick(dt,[{kind:'Rationale'},{kind:'EditRationale',text:example.rationale},{kind:'Review'},{kind:'ConfirmPractice'}]);
    expect(world.snapshot().sites[0]!.phase).toBe('restoring');expect(world.snapshot().inspectionId).toBeNull();
    for(let i=0;i<181;i++)world.tick(dt,[]);
    expect(world.snapshot().restoredSiteIds).toEqual(['pier_hoist']);
  });
});

describe('connected authority and genuine pending hooks',()=>{
  it('keeps pending, accepted, unknown finality and timeout damaged with no timer approval',()=>{
    const world=connected();
    for(const state of [{status:'pending',ticket},{status:'accepted',ticket},{status:'finalized',ticket,execution:'UNKNOWN'},{status:'timed-out',ticket,pending:true,lastObservedStatus:'ACCEPTED',message:'poll budget'}]as const){world.enqueueReview(state);for(let i=0;i<250;i++)world.tick(dt,[]);expect(world.snapshot().restoredSiteIds).toEqual([]);expect(world.snapshot().sites[0]!.phase).toBe('pending');expect(world.snapshot().sites[0]!.crew).toBe('working');}
  });
  it('lets the player walk away from pending work without unlocking a route',()=>{
    const world=connected(),before=world.snapshot().player.position;
    for(let i=0;i<40;i++)world.tick(dt,[{kind:'Move',right:1,up:0,brisk:false}]);
    expect(world.snapshot().player.position.x).toBeGreaterThan(before.x);expect(world.snapshot().restoredSiteIds).toEqual([]);
  });
  it('pauses work on finalized execution failure and keeps the original draft',()=>{
    const world=connected();world.enqueueReview({status:'accepted',ticket});world.tick(dt,[]);
    world.enqueueReview({status:'failed',ticket,reason:'execution',message:'Execution failed'});world.tick(dt,[]);
    expect(world.snapshot().sites[0]!.crew).toBe('paused');expect(world.snapshot().sites[0]!.phase).toBe('revision');expect(world.snapshot().sites[0]!.draft?.artifact).toEqual(example.artifact);expect(world.snapshot().restoredSiteIds).toEqual([]);
  });
  it('does not resurrect a terminal no-majority review as pending after reload',()=>{
    const world=connected();world.enqueueReview({status:'failed',ticket,reason:'no-majority',message:'Retry your saved build.'});world.tick(dt,[]);
    expect(world.snapshot().sites[0]!.phase).toBe('revision');expect(world.exportSave().sites[0]!.ticket).toBeNull();
    const next=new World(ISLAND_LEVEL,REPAIR_SCENARIOS,'connected',context);next.restoreSave(world.exportSave());
    expect(next.snapshot().sites[0]!.phase).toBe('damaged');expect(next.snapshot().sites[0]!.draft).toEqual(world.snapshot().sites[0]!.draft);
  });
  it('accepts equal verified technical flags regardless of JSON key order',()=>{
    const world=connected(),reordered=Object.fromEntries(Object.entries(grant.receipt.technicalFlags).reverse());
    world.enqueueReview({status:'finalized-success',decision:'approved',grant:{...grant,receipt:{...grant.receipt,technicalFlags:reordered}}});world.tick(dt,[]);
    expect(world.snapshot().sites[0]!.phase).toBe('restoring');
  });
  for(const [name,changed]of [
    ['different transaction',{...grant,txId:hash('d')}],
    ['different caller',{...grant,receipt:{...grant.receipt,caller:'0x3333333333333333333333333333333333333333'}}],
    ['different digest',{...grant,receipt:{...grant.receipt,digest:hash('d')}}],
    ['missing context flags',{...grant,receipt:{...grant.receipt,contextFlags:null}}],
    ['false context flag',{...grant,receipt:{...grant.receipt,contextFlags:{...contextFlags,protectsHabitat:false}}}],
    ['false technical flag',{...grant,receipt:{...grant.receipt,technicalFlags:{...technicalFlags,operation:false}}}],
    ['empty technical flags',{...grant,receipt:{...grant.receipt,technicalFlags:{}}}],
  ]as const)it(`rejects a forged ${name} grant`,()=>{
    const world=connected(),before=world.snapshot().sites[0]!.phase;
    world.enqueueReview({status:'finalized-success',decision:'approved',grant:changed as RestorationGrant});world.tick(dt,[]);
    expect(world.snapshot().sites[0]!.phase).toBe(before);expect(world.snapshot().restoredSiteIds).toEqual([]);
  });
  it('requires a present valid ticket transaction ID even if approval fields match',()=>{
    const {txId:ignored,...noTxId}=ticket;expect(ignored).toBeTruthy();const world=new World(ISLAND_LEVEL,REPAIR_SCENARIOS,'connected',context);
    world.enqueueReview({status:'submitted',ticket:noTxId});world.tick(dt,[]);world.enqueueReview({status:'finalized-success',decision:'approved',grant});world.tick(dt,[]);expect(world.snapshot().sites[0]!.phase).toBe('pending');
  });
  it('applies matching finalized grants only on resume and idempotently',()=>{
    const world=connected();world.tick(dt,[{kind:'Pause'}]);world.enqueueReview({status:'finalized-success',decision:'approved',grant});world.tick(dt,[]);expect(world.snapshot().sites[0]!.phase).toBe('pending');world.tick(dt,[{kind:'Pause'}]);expect(world.snapshot().sites[0]!.phase).toBe('restoring');
    for(let i=0;i<190;i++)world.tick(dt,[]);world.enqueueReview({status:'finalized-success',decision:'approved',grant});world.tick(dt,[]);expect(world.snapshot().restoredSiteIds).toEqual(['pier_hoist']);expect(world.snapshot().sites[0]!.phase).toBe('restored');
  });
  it('a local world never consumes a connected grant',()=>{const world=new World(ISLAND_LEVEL,REPAIR_SCENARIOS);world.enqueueReview({status:'submitted',ticket});world.enqueueReview({status:'finalized-success',decision:'approved',grant});world.tick(dt,[]);expect(world.snapshot().restoredSiteIds).toEqual([]);});
  for(const incoming of [{status:'pending',ticket},{status:'accepted',ticket},{status:'timed-out',ticket,pending:true,lastObservedStatus:'ACCEPTED',message:'poll budget'},{status:'finalized-success',decision:'approved',grant}]as const)it(`${incoming.status} on hoist preserves editing a different pump`,()=>{
    const world=connected();world.restoreSave({...world.exportSave(),position:{x:-18,y:4,z:24.8}});
    world.enqueueReview({status:'pending',ticket});world.tick(dt,[]);
    world.tick(dt,[{kind:'Inspect'},{kind:'SetSetting',partId:'outlet',settingId:'outlet_3'},{kind:'Rationale'},{kind:'EditRationale',text:'A separate pump draft remains editable while the hoist is reviewed.'}]);
    const before=world.snapshot();expect(before.inspectionId).toBe('village_pump');expect(before.editor?.stage).toBe('rationale');
    world.enqueueReview(incoming);world.tick(dt,[]);const after=world.snapshot();
    expect(after.inspectionId).toBe(before.inspectionId);expect(after.editor).toEqual(before.editor);expect(after.focusId).toBe(before.focusId);expect(after.sites[1]!.draft).toEqual(before.sites[1]!.draft);
  });
  it('later polls keep the same pending status inspection stable and frozen',()=>{
    const world=connected();world.restoreSave({...world.exportSave(),position:{x:-38,y:2,z:42.8}});world.enqueueReview({status:'pending',ticket});world.tick(dt,[]);world.tick(dt,[{kind:'Inspect'}]);
    const before=world.snapshot();expect(before.inspectionId).toBe('pier_hoist');world.enqueueReview({status:'accepted',ticket});world.tick(dt,[{kind:'EditRationale',text:'must not replace the pending explanation'},{kind:'SetSetting',partId:'weight_b',settingId:'rail_1000'}]);
    expect(world.snapshot().inspectionId).toBe('pier_hoist');expect(world.snapshot().sites[0]!.draft).toEqual(before.sites[0]!.draft);
  });
});

describe('transactional saves and dry recovery',()=>{
  const fresh=()=>new World(ISLAND_LEVEL,REPAIR_SCENARIOS).exportSave();
  it('separates local and caller/contract/version namespaces',()=>{expect(saveKey('practice',FIXTURE_VERSION)).not.toBe(saveKey('connected',FIXTURE_VERSION,context));expect(saveKey('connected',FIXTURE_VERSION,context)).toContain(context.caller);});
  it('round-trips caller-bound recovery tickets on StudioNet chain 61999',()=>{
    const studioContext:ConnectedContext={...context,chainId:61999};
    const studioTicket={...ticket,chainId:61999};
    const parsed=parseRecoveryTicket(studioTicket,REPAIR_SCENARIOS[0]!,studioContext);
    expect(parsed.chainId).toBe(61999);
    const world=new World(ISLAND_LEVEL,REPAIR_SCENARIOS,'connected',studioContext),data=clone(world.exportSave()) as any;
    data.sites[0].ticket=studioTicket;
    const bytes=JSON.stringify(data),storage={getItem:()=>bytes,setItem:()=>{},removeItem:()=>{}};
    const loaded=loadSave(storage,saveKey('connected',FIXTURE_VERSION,studioContext),{mode:'connected',levelId:ISLAND_LEVEL.id,context:studioContext})!;
    expect(loaded.sites[0]!.ticket).toMatchObject({chainId:61999,evmTxHash:ticket.evmTxHash});
    expect(()=>parseRecoveryTicket(ticket,REPAIR_SCENARIOS[0]!,studioContext)).toThrow('different contract/network');
  });
  for(const [name,mutate]of [
    ['duplicate IDs',(data:Record<string,any>)=>{data.sites[7].id=data.sites[0].id;}],
    ['wrong draft site',(data:Record<string,any>)=>{data.sites[7].draft.siteId='pier_hoist';}],
    ['non-text rationale',(data:Record<string,any>)=>{data.sites[7].draft.rationale=1;}],
    ['unpaired surrogate',(data:Record<string,any>)=>{data.sites[7].draft.rationale='\ud800';}],
    ['UTF-8 overrun',(data:Record<string,any>)=>{data.sites[7].draft.rationale='🌿'.repeat(700);}],
    ['non-boolean discovery',(data:Record<string,any>)=>{data.sites[7].discovered='true';}],
    ['malformed completed artifact',(data:Record<string,any>)=>{data.sites[7].completedArtifact={completed:true};}],
    ['wrong mode',(data:Record<string,any>)=>{data.mode='connected';}],
  ]as const)it(`rejects ${name} before any partial progress mutation`,()=>{
    const world=new World(ISLAND_LEVEL,REPAIR_SCENARIOS),data=clone(fresh())as unknown as Record<string,any>,before=world.snapshot();
    data.sites[0].draft=clone(example);data.sites[0].completedArtifact=clone(example.artifact);mutate(data);
    expect(()=>world.restoreSave(data as SaveData)).toThrow();expect(world.snapshot()).toEqual(before);
  });
  it('allows empty/partial journal drafts without granting completion',()=>{const data=fresh();expect(parseSave(data).sites[0]!.draft!.rationale).toBe('');});
  it('rejects corrupt storage without removing its saved bytes',()=>{const raw='{bad json',storage={getItem:()=>raw,setItem:()=>{throw new Error('must not write');},removeItem:()=>{throw new Error('must not delete');}};expect(()=>loadSave(storage,'key')).toThrow();expect(storage.getItem()).toBe(raw);});
  it('does not promote cached approvals in a connected world',()=>{
    const world=new World(ISLAND_LEVEL,REPAIR_SCENARIOS,'connected',context),data=clone(world.exportSave()) as any;
    data.sites[0].draft=clone(example);data.sites[0].completedArtifact=clone(example.artifact);data.sites[0].ticket=clone(ticket);world.restoreSave(data);
    expect(world.snapshot().restoredSiteIds).toEqual([]);expect(world.snapshot().sites[0]!.crew).toBe('none');
  });
  it('does not replay a completed history glow after original approval reverification on reload',()=>{
    const first=connected();first.enqueueReview({status:'finalized-success',decision:'approved',grant});
    for(let i=0;i<190;i++)first.tick(dt,[]);
    const saved=first.exportSave();
    for(let reopen=0;reopen<2;reopen++) {
      const next=new World(ISLAND_LEVEL,REPAIR_SCENARIOS,'connected',context);next.restoreSave(saved);
      expect(next.snapshot().restoredSiteIds).toEqual([]);expect(next.snapshot().sites[0]!.crew).toBe('none');
      next.enqueueReview({status:'finalized-success',decision:'approved',grant:{...grant,txId:hash('d')}});next.tick(dt,[]);
      expect(next.snapshot().restoredSiteIds).toEqual([]);
      next.enqueueReview({status:'finalized-success',decision:'approved',grant});next.tick(dt,[]);
      expect(next.snapshot().sites[0]!.phase).toBe('restored');expect(next.snapshot().sites[0]!.crew).toBe('none');
      expect(next.snapshot().restoredSiteIds).toEqual(['pier_hoist']);
    }
  });
  it('round-trips an actual submitted/pending world as a strict three-field draft and inactive ticket',()=>{
    const world=connected();world.enqueueReview({status:'pending',ticket});world.tick(dt,[]);
    const data=world.exportSave(),bytes=JSON.stringify(data),storage={getItem:()=>bytes,setItem:()=>{},removeItem:()=>{}};
    expect(Object.keys(data.sites[0]!.draft!).sort()).toEqual(['artifact','rationale','siteId']);expect(data.sites[0]!.ticket!.prepared.digest).toBe(ticket.prepared.digest);
    const loaded=loadSave(storage,saveKey('connected',FIXTURE_VERSION,context),{mode:'connected',levelId:ISLAND_LEVEL.id,context})!;
    const next=new World(ISLAND_LEVEL,REPAIR_SCENARIOS,'connected',context);next.restoreSave(loaded);
    expect(next.snapshot().sites[0]!.draft).toEqual({siteId:example.siteId,artifact:example.artifact,rationale:example.rationale});expect(next.snapshot().sites[0]!.ticket).toEqual(ticket);expect(next.snapshot().sites[0]!.crew).toBe('none');expect(next.snapshot().restoredSiteIds).toEqual([]);
  });
  it('rejects ticket context/fixture/digest-shape mismatches',()=>{
    for(const patch of [{digest:'not-a-hash'},{fixtureVersion:'other'},{caller:'0x3333333333333333333333333333333333333333'}]){
      const world=new World(ISLAND_LEVEL,REPAIR_SCENARIOS,'connected',context),data=clone(world.exportSave())as any;data.sites[0].ticket={...ticket,prepared:{...ticket.prepared,...patch}};expect(()=>world.restoreSave(data)).toThrow();expect(world.snapshot().restoredSiteIds).toEqual([]);
    }
  });
  it('recovers a whole-footprint overhang to the clear landing',()=>{
    // A bounded synthetic shore remains independent of legitimate island
    // expansion. The centre is supported but the +X foot is beyond the mesh.
    const level:LevelData={...SMOKE_LEVEL,bounds:{minX:-64,maxX:64,minZ:-64,maxZ:64}};
    const world=new World(level,REPAIR_SCENARIOS),position={x:-24.1,y:sampleGround(level,-24.1,50)!.y,z:50},data={...world.exportSave(),position};
    expect(sampleGround(level,position.x,position.z)).not.toBeNull();expect(sampleGround(level,position.x+.28,position.z)).toBeNull();
    expect(dryStandingGround(level,position)).toBeNull();world.restoreSave(data);expect(world.snapshot().player.position).toEqual(level.spawn);
  });
  it('recovers a saved closed-gate position, not merely a dry centre',()=>{
    const level:LevelData={...SMOKE_LEVEL,obstacles:[...SMOKE_LEVEL.obstacles,{id:'closed',minX:-39,maxX:-37,minZ:46,maxZ:49,blockedUntil:['pier_hoist']}]};
    const world=new World(level,REPAIR_SCENARIOS),data={...world.exportSave(),position:{x:-38,y:2,z:48}};expect(sampleGround(level,-38,48)).not.toBeNull();world.restoreSave(data);expect(world.snapshot().player.position).toEqual(level.spawn);
  });
  it('rejects steep standing normals before recovering position',()=>{
    const level:LevelData={...SMOKE_LEVEL,triangles:SMOKE_LEVEL.triangles.map((t)=>({...t,a:{...t.a,y:t.a.y+(t.a.x<-45?(t.a.x+45)*2:0)},b:{...t.b,y:t.b.y+(t.b.x<-45?(t.b.x+45)*2:0)},c:{...t.c,y:t.c.y+(t.c.x<-45?(t.c.x+45)*2:0)}}))};
    const world=new World(level,REPAIR_SCENARIOS);world.restoreSave({...world.exportSave(),position:{x:-49,y:2,z:48}});expect(world.snapshot().player.position).toEqual(level.spawn);
  });
  it('the bridge and flood surfaces require their actual restorations',()=>{expect(sampleGround(ISLAND_LEVEL,0,-2)).toBeNull();expect(sampleGround(ISLAND_LEVEL,0,-2,new Set(['creek_bridge']))?.y).toBeCloseTo(6);expect(sampleGround(ISLAND_LEVEL,-7.0,1.6)).toBeNull();expect(sampleGround(ISLAND_LEVEL,-7.0,1.6,new Set(['village_pump','tidal_sluice']))?.y).toBeCloseTo(6);});
});
