import {abi} from 'genlayer-js';
import {REPAIR_SCENARIOS,FIXTURE_VERSION} from './catalog';
import {digestRepairSubmission} from './canonical';
import {validateRepairLocally} from './advisory';
import {createRepairArtifact,normalizeAddress,normalizeNonce,normalizeRationale} from './schema';
import {hash,object} from './evidence';
import type {Address,PreparedRepair,RecoveryTicket} from './types';

/** Studio history is a discovery hint only. Every returned ticket must still
 * pass original-log, transaction, finality and contract-receipt verification. */
export async function studioRecoveryTickets(input:unknown,caller:Address,addressFor:(siteId:string)=>Address,expeditionId:string):Promise<readonly RecoveryTicket[]> {
  if(!Array.isArray(input))throw new Error('Wallet history is unavailable.');
  const addresses=new Map(REPAIR_SCENARIOS.map(site=>[addressFor(site.id).toLowerCase(),site.id]));
  const tickets=new Map<string,RecoveryTicket>();
  for(const item of input.slice(0,2000)) {
    if(tickets.size>=32)break;
    try {
      const row=object(item);
      if(normalizeAddress(row.from_address as string)!==caller)continue;
      const contractAddress=normalizeAddress(row.to_address as string),siteId=addresses.get(contractAddress);
      if(!siteId)continue;
      const data=object(row.data),encoded=data.calldata;
      if(typeof encoded!=='string'||encoded.length>60000)continue;
      const call=abi.calldata.decode(Uint8Array.from(atob(encoded),char=>char.charCodeAt(0)));
      if(!(call instanceof Map)||call.get('method')!=='submit_repair')continue;
      const args=call.get('args');
      if(!Array.isArray(args)||args.length!==5||args[0]!==expeditionId||args[1]!==siteId||typeof args[2]!=='string'||args[2].length>30000||
        !(typeof args[4]==='bigint'||typeof args[4]==='number'&&Number.isSafeInteger(args[4])))continue;
      const artifact=createRepairArtifact(JSON.parse(args[2]),REPAIR_SCENARIOS.find(site=>site.id===siteId)!);
      const rationale=normalizeRationale(args[3] as string),nonce=normalizeNonce(String(args[4]));
      const local=validateRepairLocally(siteId,artifact);
      if(!local.valid)continue;
      const prepared:PreparedRepair=Object.freeze({siteId,artifact,rationale,caller,expeditionId:expeditionId as `0x${string}`,nonce,fixtureVersion:FIXTURE_VERSION,
        technicalFlags:Object.freeze({...local.flags,dependencies:true,nonce:true,newSite:true}),technicallyValid:true,
        digest:await digestRepairSubmission({chainId:61999,nativeChainId:61999,contractAddress,caller,expeditionId:expeditionId as `0x${string}`,siteId,nonce,fixtureVersion:FIXTURE_VERSION},artifact,rationale)});
      const txHash=hash(row.hash);
      tickets.set(txHash,Object.freeze({version:2,chainId:61999,contractAddress,prepared,evmTxHash:txHash,txId:txHash}));
    }catch{/* Unrelated or malformed history cannot create an approval. */}
  }
  return Object.freeze([...tickets.values()]);
}
