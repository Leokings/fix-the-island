import {describe,expect,it,vi} from 'vitest';
import {createRepairExampleDraft,FIXTURE_VERSION,REPAIR_SCENARIOS} from '../../src/genlayer';
import type {ApprovalEvidence,GenLayerAdapter,PreparedRepair,RepairState,RecoveryTicket} from '../../src/genlayer';
import type {ConnectedContext} from '../../src/domain/world';
import {submissionAvailable,submitRepair,type SubmissionSession} from '../../src/application/submit-repair';
import {recoverRepairs} from '../../src/application/recover-repairs';
const context:ConnectedContext={caller:'0x1111111111111111111111111111111111111111',expeditionId:`0x${'d'.repeat(64)}`,contractAddress:'0x2222222222222222222222222222222222222222',chainId:4221,siteAddresses:Object.fromEntries(REPAIR_SCENARIOS.map(site=>[site.id,'0x2222222222222222222222222222222222222222']))};
const hash=(n:number)=>`0x${n.toString(16).padStart(64,'0')}` as const;
const draft=createRepairExampleDraft('pier_hoist','valid'); // Synthetic unit data, never browser progress.
const prepared:PreparedRepair={...draft,caller:context.caller,expeditionId:context.expeditionId,fixtureVersion:FIXTURE_VERSION,nonce:'0',digest:hash(1),technicalFlags:{unit:true},technicallyValid:true};
const ticket:RecoveryTicket={version:2,chainId:4221,contractAddress:context.contractAddress,prepared,evmTxHash:hash(2),txId:hash(3)};
const session=():SubmissionSession=>({owner:{},context:{...context},epoch:1});
const result:RepairState={status:'submitted',ticket};
describe('explicit connected submission orchestration without any wallet',()=>{
  it('submits the identical registered object after prepare emits queued',async()=>{
    let state:RepairState={status:'ready',wallet:context.caller};const owning=session();
    const submit=vi.fn(async(input:PreparedRepair)=>{expect(state.status).toBe('queued');expect(input).toBe(prepared);return result;});
    const prepare=vi.fn(async()=>{state={status:'queued',prepared};return prepared;});
    expect(await submitRepair({prepare,submit},draft,owning,()=>owning)).toBe(result);expect(submit).toHaveBeenCalledTimes(1);
  });
  for(const [name,change]of [
    ['world',(s:SubmissionSession)=>({...s,owner:{}})],
    ['account',(s:SubmissionSession)=>({...s,context:{...s.context,caller:'0x3333333333333333333333333333333333333333' as const}})],
    ['contract',(s:SubmissionSession)=>({...s,context:{...s.context,contractAddress:'0x3333333333333333333333333333333333333333' as const}})],
    ['session',(s:SubmissionSession)=>({...s,epoch:2})],
    ['disconnected',()=>null],
  ]as const)it(`does not submit after a stale ${name} switch`,async()=>{
    const owning=session();let active:SubmissionSession|null=owning;
    const prepare=vi.fn(async()=>{active=change(owning);return prepared;}),submit=vi.fn(async()=>result);
    expect(await submitRepair({prepare,submit},draft,owning,()=>active)).toBeNull();expect(submit).not.toHaveBeenCalled();
  });
  it('permits resolved terminal retries but never unresolved or ambiguous broadcasts',()=>{
    for(const state of [{status:'ready',wallet:context.caller},{status:'wallet-rejected',message:'declined'},{status:'failed',reason:'execution',ticket,message:'failed'}]as const)expect(submissionAvailable(state,context,context.caller,false,false,false)).toBe(true);
    for(const state of [{status:'pending',ticket},{status:'accepted',ticket},{status:'timed-out',ticket,pending:true,lastObservedStatus:'ACCEPTED',message:'timeout'},{status:'failed',reason:'undetermined',ticket,message:'nonfinal'},{status:'network-error',message:'unknown hash'}]as const)expect(submissionAvailable(state,context,context.caller,false,false,false)).toBe(false);
    expect(submissionAvailable({status:'ready',wallet:context.caller},context,context.caller,false,true,false)).toBe(false);
    expect(submissionAvailable({status:'ready',wallet:context.caller},context,context.caller,false,false,true)).toBe(false);
    expect(submissionAvailable({status:'ready',wallet:context.caller},context,null,false,false,false)).toBe(false);
  });
});
describe('serialized original-broadcast recovery, not cached approvals',()=>{
  const archive:readonly ApprovalEvidence[]=REPAIR_SCENARIOS.map((site,i)=>({kind:'approved-broadcast-v1',...ticket,prepared:{...prepared,...createRepairExampleDraft(site.id,'valid'),nonce:String(i)},evmTxHash:hash(i+10),txId:hash(i+20)}));
  function fixture(){const restored:string[]=[],calls:string[]=[],waits:string[]=[];let inFlight=0;
    const reverifyApproval=vi.fn(async(evidence:ApprovalEvidence):Promise<RepairState>=>{expect(inFlight++).toBe(0);expect(REPAIR_SCENARIOS.find((s)=>s.id===evidence.prepared.siteId)!.requires.every((id)=>restored.includes(id))).toBe(true);calls.push(evidence.prepared.siteId);inFlight--;return {status:'finalized-success',decision:'approved',grant:{mode:'connected',finality:'FINALIZED',execution:'SUCCEEDED',chainId:4221,contractAddress:context.contractAddress,txId:evidence.txId,evmTxHash:evidence.evmTxHash,receipt:{...evidence.prepared,decision:'approved',contextFlags:{unit:true},feedback:'synthetic orchestration test'}}};});
    const adapter:Pick<GenLayerAdapter,'getApprovalEvidence'|'getRecoveryTickets'|'reverifyApproval'|'resume'>={getApprovalEvidence:()=>archive,getRecoveryTickets:()=>[],reverifyApproval,resume:vi.fn(async()=>result)};
    const world={restored:()=>restored,savedTickets:()=>[],waitForRestored:async(id:string)=>{waits.push(id);restored.push(id);}};
    return {adapter,world,restored,calls,waits};
  }
  it('waits for actual parent installations, then rechecks children; no repeat pulse',async()=>{
    const f=fixture(),owning=session(),signal=new AbortController().signal;
    expect(await recoverRepairs(f.adapter,'approvals',owning,()=>owning,f.world,signal)).toBe(8);expect(f.calls).toEqual(f.waits);expect(f.calls).toHaveLength(8);
    expect(await recoverRepairs(f.adapter,'approvals',owning,()=>owning,f.world,signal)).toBe(0);expect(f.calls).toHaveLength(8);
  });
  it('stops after a changed owner and never hydrates cached site IDs',async()=>{
    const f=fixture(),owning=session();let active:SubmissionSession|null=owning;
    f.adapter.reverifyApproval=async()=>{active=null;return result;};
    expect(await recoverRepairs(f.adapter,'approvals',owning,()=>active,f.world,new AbortController().signal)).toBe(1);expect(f.restored).toEqual([]);
  });
  it('explicit review recovery invokes resume once, never prepare or submit',async()=>{
    const f=fixture(),owning=session();f.adapter.getRecoveryTickets=()=>[ticket,ticket];
    expect(await recoverRepairs(f.adapter,'reviews',owning,()=>owning,f.world,new AbortController().signal)).toBe(1);expect(f.adapter.resume).toHaveBeenCalledTimes(1);expect(f.adapter.reverifyApproval).not.toHaveBeenCalled();
  });
  it('automatically checks all proofs in dependency order with a single read per original transaction',async()=>{
    const f=fixture(),owning=session();
    expect(await recoverRepairs(f.adapter,'all',owning,()=>owning,f.world,new AbortController().signal)).toBe(8);
    expect(f.restored).toEqual(REPAIR_SCENARIOS.map(site=>site.id));
    expect(f.adapter.reverifyApproval).toHaveBeenCalledWith(archive[0],expect.any(AbortSignal),{once:true});
  });
  it('resolves a failed Bridge transaction even when parent recovery is temporarily unavailable',async()=>{
    const f=fixture(),owning=session(),bridge={...ticket,prepared:{...prepared,...createRepairExampleDraft('creek_bridge','valid')}};
    f.adapter.getApprovalEvidence=()=>[];f.adapter.getRecoveryTickets=()=>[bridge];
    f.adapter.resume=vi.fn(async()=>({status:'failed',reason:'no-majority',ticket:bridge,message:'Retry saved build.'} as const));
    expect(await recoverRepairs(f.adapter,'all',owning,()=>owning,f.world,new AbortController().signal)).toBe(1);
    expect(f.adapter.resume).toHaveBeenCalledWith(bridge,expect.any(AbortSignal),{once:true});expect(f.restored).toEqual([]);
  });
});
