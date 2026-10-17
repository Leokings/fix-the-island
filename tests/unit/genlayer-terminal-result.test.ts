import {describe,expect,it} from 'vitest';
import {createRepairExampleDraft} from '../../src/genlayer/examples';
import {submissionData,transactionEvidence} from '../../src/genlayer/evidence';
import {submissionAvailable} from '../../src/application/submit-repair';
import type {Address,Hash,PreparedRepair,RecoveryTicket,RepairState} from '../../src/genlayer/types';
import type {ConnectedContext} from '../../src/domain/world';

const caller=`0x${'1'.repeat(40)}` as Address;
const contractAddress=`0x${'2'.repeat(40)}` as Address;
const evmTxHash=`0x${'a'.repeat(64)}` as Hash;
const txId=`0x${'b'.repeat(64)}` as Hash;
const draft=createRepairExampleDraft('creek_bridge','valid');
const prepared={...draft,caller,expeditionId:`0x${'d'.repeat(64)}`,nonce:'0'} as PreparedRepair;
const ticket={version:2,chainId:61999,contractAddress,evmTxHash,txId,prepared} as RecoveryTicket;

function transaction(result:number,resultName:string) {
  return {txId,from_address:caller,to_address:contractAddress,txData:submissionData(prepared),status:7,statusName:'FINALIZED',result,result_name:resultName};
}

describe('finalized GenLayer consensus outcomes',()=>{
  it('preserves NO_MAJORITY as distinct evidence when the transaction is finalized',()=>{
    expect(transactionEvidence(transaction(5,'NO_MAJORITY'),ticket)).toEqual({status:'FINALIZED',execution:'UNKNOWN',consensusResult:'NO_MAJORITY'});
  });

  it('does not accept conflicting numeric and named consensus results',()=>{
    expect(()=>transactionEvidence(transaction(5,'MAJORITY_AGREE'),ticket)).toThrow('Chain evidence does not match');
  });

  it('allows a fresh submission after finalized no-majority, but not an unresolved timeout',()=>{
    const context={caller,expeditionId:`0x${'d'.repeat(64)}`,contractAddress,chainId:61999} as ConnectedContext;
    const available=(state:RepairState)=>submissionAvailable(state,context,caller,false,false,false);
    expect(available({status:'failed',reason:'no-majority',ticket,message:'No majority.'} as RepairState)).toBe(true);
    expect(available({status:'failed',reason:'undetermined',ticket,message:'Still unresolved.'} as RepairState)).toBe(false);
  });
  it('does not block a different repair behind an unrelated pending review',()=>{
    const context={caller,expeditionId:`0x${'d'.repeat(64)}`,contractAddress,chainId:61999} as ConnectedContext;
    expect(submissionAvailable({status:'pending',ticket},context,caller,false,false,false,'tidal_sluice')).toBe(true);
    expect(submissionAvailable({status:'pending',ticket},context,caller,false,true,false,'creek_bridge')).toBe(false);
  });
});
