import {describe,expect,it} from 'vitest';
import {abi} from 'genlayer-js';
import {studioRecoveryTickets} from '../../src/genlayer/studio-recovery';
import {createRepairExampleDraft} from '../../src/genlayer/examples';
import {canonicalizeRepairArtifact,digestRepairSubmission} from '../../src/genlayer/canonical';
import {FIXTURE_VERSION} from '../../src/genlayer/catalog';

const caller=`0x${'1'.repeat(40)}` as const,contractAddress=`0x${'2'.repeat(40)}` as const,txHash=`0x${'a'.repeat(64)}` as const;
const expeditionId=`0x${'d'.repeat(64)}` as const;
const draft=createRepairExampleDraft('creek_bridge','valid');
const addressFor=(siteId:string)=>siteId==='creek_bridge'?contractAddress:`0x${'4'.repeat(40)}` as const;
function row(method='submit_repair') {
  const calldata=abi.calldata.encode(abi.calldata.makeCalldataObject(method,[expeditionId,draft.siteId,canonicalizeRepairArtifact(draft.artifact),draft.rationale,0n],undefined));
  return {hash:txHash,from_address:caller,to_address:contractAddress,data:{calldata:Buffer.from(calldata).toString('base64')}};
}
describe('Studio wallet history discovery',()=>{
  it('recovers the frozen build without a browser save, bound to caller, contract and nonce',async()=>{
    const tickets=await studioRecoveryTickets([row()],caller,addressFor,expeditionId);
    expect(tickets).toHaveLength(1);
    const ticket=tickets[0]!;
    expect(ticket).toMatchObject({version:2,chainId:61999,contractAddress,evmTxHash:txHash,txId:txHash,prepared:{siteId:'creek_bridge',expeditionId,nonce:'0',caller}});
    expect(ticket.prepared.digest).toBe(await digestRepairSubmission({chainId:61999,contractAddress,caller,expeditionId,siteId:draft.siteId,nonce:'0',fixtureVersion:FIXTURE_VERSION},draft.artifact,draft.rationale));
    expect(ticket).not.toHaveProperty('decision');expect(ticket).not.toHaveProperty('grant');
  });
  it('ignores other wallets, unrelated contracts, methods and malformed calldata',async()=>{
    const good=row();
    expect(await studioRecoveryTickets([
      {...good,from_address:`0x${'3'.repeat(40)}`},
      {...good,to_address:`0x${'3'.repeat(40)}`},row('approve'),
      {...good,data:{calldata:'not base64'}}, {...good,data:{calldata:'a'.repeat(60001)}},
    ],caller,addressFor,expeditionId)).toEqual([]);
  });
});
