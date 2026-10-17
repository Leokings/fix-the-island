import {describe,expect,it} from 'vitest';
import {encodeEventTopics,type Abi} from 'viem';
import {studionet} from 'genlayer-js/chains';
import {normalizeEvmReceiptStatus,receiptEvidence,TECHNICAL_FLAGS,transactionIdFromReceipt} from '../../src/genlayer/evidence';
import {createRepairExampleDraft,FIXTURE_VERSION} from '../../src/genlayer';
import {digestRepairSubmission} from '../../src/genlayer/canonical';
import type {RecoveryTicket} from '../../src/genlayer';

const caller=`0x${'1'.repeat(40)}` as const;
const contractAddress=`0x${'2'.repeat(40)}` as const;
const evmTxHash=`0x${'a'.repeat(64)}` as const;
const txId=`0x${'b'.repeat(64)}` as const;
const plan='A concrete repair plan with regular maintenance.';
const ticket={version:2,chainId:61999,contractAddress,evmTxHash,prepared:{caller,expeditionId:`0x${'d'.repeat(64)}`,siteId:'pier_hoist',nonce:'0'}} as RecoveryTicket;

describe('GenLayer EVM receipt status normalization',()=>{
  it.each([
    ['success','success'],['0x1','success'],[1,'success'],
    ['reverted','reverted'],['0x0','reverted'],[0,'reverted'],
    [undefined,'unknown'],['0x2','unknown'],['pending','unknown'],
  ] as const)('normalizes %s to %s', (input, expected)=>{
    expect(normalizeEvmReceiptStatus(input)).toBe(expected);
  });
});

it('extracts StudioNet NewTransaction from the repair-contract receipt log, bound to contract and caller',()=>{
  const consensus=studionet.consensusMainContract!;
  const eventTopics=encodeEventTopics({abi:consensus.abi as Abi,eventName:'NewTransaction',args:{txId,recipient:contractAddress,activator:caller}});
  const receipt={transactionHash:evmTxHash,status:'0x1',logs:[{address:contractAddress,topics:eventTopics,data:'0x'}]};
  expect(transactionIdFromReceipt(receipt,ticket,consensus.address,consensus.abi)).toBe(txId);
  const wrongCaller={...receipt,logs:[{address:contractAddress,topics:encodeEventTopics({abi:consensus.abi as Abi,eventName:'NewTransaction',args:{txId,recipient:contractAddress,activator:`0x${'3'.repeat(40)}`}}),data:'0x'}]};
  expect(()=>transactionIdFromReceipt(wrongCaller,ticket,consensus.address,consensus.abi)).toThrow('Chain evidence does not match');
  expect(transactionIdFromReceipt({...receipt,logs:[{...receipt.logs[0]!,address:`0x${'4'.repeat(40)}`} ]},ticket,consensus.address,consensus.abi)).toBeNull();
});

it('accepts a finalized pump receipt when its optional evidence quote is absent or low quality',async()=>{
  const draft=createRepairExampleDraft('village_pump','valid');
  const expeditionId=`0x${'d'.repeat(64)}` as const;
  const fixtureVersion=FIXTURE_VERSION;
  const technicalFlags=Object.fromEntries(TECHNICAL_FLAGS.map(name=>[name,true]));
  const digest=await digestRepairSubmission({chainId:61999,nativeChainId:61999,contractAddress,caller,expeditionId,siteId:'village_pump',nonce:'0',fixtureVersion},draft.artifact,plan);
  const prepared={...draft,rationale:plan,caller,expeditionId,nonce:'0',digest,fixtureVersion,technicalFlags,technicallyValid:true};
  const recovery={...ticket,prepared} as RecoveryTicket;
  const councilResult={schemaVersion:'island-council-v2',catalogVersion:'village-pump-council-2',siteId:'village_pump',
    scenarioId:'water-shortage-nesting-season',chosenDesignId:'direct_pump',decision:'approve',quality:'good'};
  for(const evidenceQuote of [null,'weak']) {
    const record={...prepared,decision:'approved',contextFlags:{groundedInArtifact:true,explainsTradeoff:true,protectsHabitat:true,safeUseAndMaintenance:true},
      feedback:'The design fits the site facts.',designId:'direct_pump',councilResult,evidenceQuote};
    const receipt=await receiptEvidence(record,recovery,61999,61999);
    expect(receipt.decision).toBe('approved');
    expect(receipt.evidenceQuote).toBeUndefined();
    expect(receipt.councilResult).toMatchObject(councilResult);
    // As the deployed pump contract writes it: no expeditionId inside the record.
    const {expeditionId:_bound,technicallyValid:_derived,...contractShaped}=record;
    expect((await receiptEvidence(contractShaped,recovery,61999,61999)).decision).toBe('approved');
  }
});

describe('receipts shaped like the deployed site contracts',()=>{
  // The contract stores receipts under (caller, expeditionId, nonce) and writes only
  // these keys; the expedition is not repeated inside the record.
  const expeditionId=`0x${'d'.repeat(64)}` as const;
  async function hoist(expedition:`0x${string}`) {
    const draft=createRepairExampleDraft('pier_hoist','valid');
    const technicalFlags=Object.fromEntries(TECHNICAL_FLAGS.map(name=>[name,true]));
    const digest=await digestRepairSubmission({chainId:61999,nativeChainId:61999,contractAddress,caller,expeditionId:expedition,siteId:'pier_hoist',nonce:'0',fixtureVersion:FIXTURE_VERSION},draft.artifact,plan);
    const prepared={...draft,rationale:plan,caller,expeditionId:expedition,nonce:'0',digest,fixtureVersion:FIXTURE_VERSION,technicalFlags,technicallyValid:true};
    const record={caller,siteId:'pier_hoist',artifact:draft.artifact,rationale:plan,nonce:'0',digest,fixtureVersion:FIXTURE_VERSION,technicalFlags,
      decision:'approved',contextFlags:{explainsTradeoff:true,groundedInArtifact:true,protectsHabitat:true,safeUseAndMaintenance:true},feedback:'Assessment recorded.'};
    return {record,ticket:{...ticket,prepared} as RecoveryTicket};
  }
  it('accepts a contract receipt that has no expeditionId field',async()=>{
    const {record,ticket:own}=await hoist(expeditionId);
    expect(Object.hasOwn(record,'expeditionId')).toBe(false);
    const receipt=await receiptEvidence(record,own,61999,61999);
    expect(receipt).toMatchObject({decision:'approved',expeditionId,siteId:'pier_hoist',rationale:plan});
  });
  it('rejects a receipt from another expedition, by digest or by an explicit field',async()=>{
    const {record}=await hoist(`0x${'e'.repeat(64)}`);
    const {ticket:other}=await hoist(expeditionId);
    await expect(receiptEvidence(record,other,61999,61999)).rejects.toThrow('Chain evidence does not match');
    const {record:own,ticket:mine}=await hoist(expeditionId);
    await expect(receiptEvidence({...own,expeditionId:`0x${'e'.repeat(64)}`},mine,61999,61999)).rejects.toThrow('Chain evidence does not match');
  });
});
