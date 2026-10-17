import {describe,expect,it} from 'vitest';
import {abi} from 'genlayer-js';
import {createRepairExampleDraft,digestRepairSubmission,FIXTURE_VERSION,validateRepairLocally} from '../src/genlayer';
import {dependencyRuntimeRequest,verifyRuntimePreparation} from '../src/genlayer/runtime-check';
import type {Address,PreparedRepair} from '../src/genlayer';
import {canonicalizeRepairArtifact} from '../src/genlayer/canonical';
const caller=`0x${'1'.repeat(40)}` as Address,address=`0x${'2'.repeat(40)}` as Address;
async function prepared():Promise<PreparedRepair> {
  const draft=createRepairExampleDraft('creek_bridge','valid');
  const local=validateRepairLocally(draft.siteId,draft.artifact);
  const expeditionId=`0x${'e'.repeat(64)}` as const;
  return {...draft,caller,expeditionId,nonce:'0',fixtureVersion:FIXTURE_VERSION,
    technicalFlags:{...local.flags,dependencies:true,nonce:true,newSite:true},technicallyValid:true,
    digest:await digestRepairSubmission({chainId:61999,nativeChainId:61999,contractAddress:address,caller,expeditionId,
      siteId:draft.siteId,nonce:'0',fixtureVersion:FIXTURE_VERSION},draft.artifact,draft.rationale)};
}
const encoded=(value:unknown)=>abi.transactions.serializeOne(abi.calldata.encode(value as Parameters<typeof abi.calldata.encode>[0]));
describe('bounded finalized prerequisite runtime gate',()=>{
  it('requests only the exact prepare_repair view on finalized outer state',async()=>{
    const draft=await prepared(),request=dependencyRuntimeRequest(draft,address),input=request.params[0];
    expect(input).toMatchObject({type:'read',to:address,from:caller,transaction_hash_variant:'latest-final'});
    const call=abi.calldata.decode(Uint8Array.from(Buffer.from(input.data.slice(2),'hex'))) as Map<string,unknown>;
    expect(call.get('method')).toBe('prepare_repair');
    const args=call.get('args') as unknown[];
    expect(args.slice(1)).toEqual([draft.expeditionId,draft.siteId,canonicalizeRepairArtifact(draft.artifact),draft.rationale,0n]);
  });
  it('verifies a full prepared result with extra metrics without treating it as approval',async()=>{
    const draft=await prepared(),body={...draft,metrics:{capacity:8},materialCost:18,designId:null};
    await expect(verifyRuntimePreparation(encoded(body),draft,address,61999,61999)).resolves.toBeUndefined();
    await expect(verifyRuntimePreparation({data:encoded(body).slice(2),status:{code:0}},draft,address,61999,61999)).resolves.toBeUndefined();
  });
  it.each(['deadbeef','ff','8601','06','0c','0'.repeat(128002)])('rejects malformed or oversized binary promptly: %.12s',async value=>{
    const draft=await prepared();
    await expect(verifyRuntimePreparation(value,draft,address,61999,61999)).rejects.toMatchObject({code:'INVALID_EVIDENCE'});
  });
  it.each(['digest','caller','nonce','siteId'] as const)('rejects mismatched %s without registering a design',async field=>{
    const draft=await prepared(),bad={...draft,[field]:field==='nonce'?'1':field==='siteId'?'pier_hoist':`0x${'3'.repeat(field==='digest'?64:40)}`};
    await expect(verifyRuntimePreparation(encoded(bad),draft,address,61999,61999)).rejects.toMatchObject({code:'INVALID_EVIDENCE'});
  });
  it('rejects missing finalized prerequisites even with a valid artifact digest',async()=>{
    const draft=await prepared();
    const bad={...draft,technicalFlags:{...draft.technicalFlags,dependencies:false},technicallyValid:false};
    await expect(verifyRuntimePreparation(encoded(bad),draft,address,61999,61999)).rejects.toMatchObject({code:'INVALID_EVIDENCE'});
  });
  it('does not confuse an RPC execution error with a prepared result',async()=>{
    const draft=await prepared();
    await expect(verifyRuntimePreparation({data:encoded(draft),status:{code:1,message:'untrusted'}},draft,address,61999,61999))
      .rejects.toMatchObject({code:'RUNTIME_UNAVAILABLE'});
  });
});
