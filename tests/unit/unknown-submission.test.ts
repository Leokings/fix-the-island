import {describe,expect,it,vi} from 'vitest';
import {createRepairExampleDraft,FIXTURE_VERSION} from '../../src/genlayer';
import type {PreparedRepair} from '../../src/genlayer';
import type {ConnectedContext} from '../../src/domain/world';
import {UnknownSubmissionStore,unknownSubmissionKey} from '../../src/application/unknown-submission';
import {submissionAvailable,submitRepair} from '../../src/application/submit-repair';
const context:ConnectedContext={caller:'0x1111111111111111111111111111111111111111',expeditionId:`0x${'d'.repeat(64)}`,contractAddress:'0x2222222222222222222222222222222222222222',chainId:4221};
const prepared:PreparedRepair={...createRepairExampleDraft('pier_hoist','valid'),caller:context.caller,expeditionId:context.expeditionId,fixtureVersion:FIXTURE_VERSION,nonce:'0',digest:`0x${'a'.repeat(64)}`,technicalFlags:{unit:true},technicallyValid:true};
function fixture(){const data=new Map<string,string>(),storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);},removeItem:(key:string)=>{data.delete(key);}};return {data,storage,store:new UnknownSubmissionStore(storage)};}
describe('durable unknown broadcast safety latch (mock storage, no signer)',()=>{
  it('survives a mocked reload and reconnect readiness does not allow another broadcast',()=>{
    const f=fixture();f.store.mark(context,prepared);const reloaded=new UnknownSubmissionStore(f.storage).read(context);
    expect(reloaded.uncertain).toBe(true);expect(reloaded.prepared[0]).toEqual(prepared);expect(submissionAvailable({status:'ready',wallet:context.caller},context,context.caller,false,false,reloaded.uncertain)).toBe(false);
  });
  it('persists before submit and a failed storage write prevents even the mock submission',async()=>{
    const store=new UnknownSubmissionStore({getItem:()=>null,setItem:()=>{throw new Error('storage blocked');},removeItem:()=>{}}),owning={owner:{},context,epoch:1},submit=vi.fn();
    await expect(submitRepair({prepare:async()=>prepared,submit},prepared,owning,()=>owning,(p)=>store.mark(context,p))).rejects.toThrow('storage blocked');expect(submit).not.toHaveBeenCalled();
  });
  it('a verified original nonce/digest resolves only that exact caller-bound marker',()=>{
    const f=fixture();f.store.mark(context,prepared);f.store.resolveVerified(context,'1',prepared.digest);expect(f.store.read(context).uncertain).toBe(true);
    f.store.resolveVerified(context,'0',`0x${'b'.repeat(64)}`);expect(f.store.read(context).uncertain).toBe(true);f.store.resolveVerified(context,'0',prepared.digest);expect(f.store.read(context).uncertain).toBe(false);
  });
  it('is version/contract/caller isolated, and malformed cache stays blocked',()=>{
    const f=fixture();f.store.mark(context,prepared);expect(f.store.read({...context,caller:'0x3333333333333333333333333333333333333333'}).uncertain).toBe(false);
    f.data.set(unknownSubmissionKey(context),'bad JSON');expect(f.store.read(context)).toEqual({uncertain:true,prepared:[]});
  });
  it('only explicit wallet activity acknowledgement clears the latch, leaving review/progress keys untouched',()=>{
    const f=fixture();f.storage.setItem('pending','retain');f.store.mark(context,prepared);f.store.acknowledgeNoBroadcast(context);expect(f.store.read(context).uncertain).toBe(false);expect(f.storage.getItem('pending')).toBe('retain');
  });
});
