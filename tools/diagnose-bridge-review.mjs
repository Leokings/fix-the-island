// Read-only diagnostics. No account, signer, deploy, write, or broadcast API.
import {abi,createClient} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {CalldataAddress,TransactionHashVariant} from 'genlayer-js/types';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const caller='0x63038a310a46ac61a59c1bc5ead5fe41040ef38e';
const addresses=JSON.parse(readFileSync('src/genlayer/deployments.studionet.json','utf8'));
const manifest=JSON.parse(readFileSync('contracts/sites/manifest.json','utf8'));
const rpcUrl='https://studio.genlayer.com/api';
let requestId=0;
async function rpc(method,params,timeoutMs=35000) {
  if(!['sim_getTransactionsForAddress','sim_call','eth_chainId'].includes(method))throw new Error('Read-only allowlist');
  const response=await fetch(rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:++requestId,method,params}),signal:AbortSignal.timeout(timeoutMs)});
  const data=await response.json();
  if(data.error)throw new Error(JSON.stringify(data.error));
  return data.result;
}
const client=createClient({chain:studionet});
const calldataCaller=new CalldataAddress(Uint8Array.from(Buffer.from(caller.slice(2),'hex')));
const history=await rpc('sim_getTransactionsForAddress',[caller]);
const repairs=history.filter(row=>Object.values(addresses).some(address=>address.toLowerCase()===row.to_address?.toLowerCase()));
for(const row of repairs) {
  const call=abi.calldata.decode(Uint8Array.from(Buffer.from(row.data.calldata,'base64')));
  if(call.get('method')!=='submit_repair')continue;
  console.log(JSON.stringify({kind:'original-transaction',hash:row.hash,siteId:call.get('args')[0],createdAt:row.created_at,status:row.status,
    leaders:row.consensus_data?.leader_receipt?.map(receipt=>({execution:receipt.execution_result,durationMs:receipt.processing_time,error:receipt.genvm_result,model:receipt.node_config?.model})),votes:row.consensus_data?.votes,
    result:row.result==='timeout'?'timeout':'binary-return-omitted'}));
}
for(const site of ['pier_hoist','village_pump','tidal_sluice','creek_bridge']) {
  const start=performance.now();
  const source=await client.getContractCode(addresses[site]);
  const sourceHash='0x'+createHash('sha256').update(source.replace(/\r\n/g,'\n')).digest('hex');
  const progress=await client.readContract({address:addresses[site],functionName:'get_progress',args:[calldataCaller],
    leaderOnly:false,jsonSafeReturn:true,transactionHashVariant:TransactionHashVariant.LATEST_FINAL});
  console.log(JSON.stringify({kind:'source-and-progress',site,sourceBytes:Buffer.byteLength(source),sourceMatchesLocal:sourceHash===manifest[site].codeHash,
    runner:source.split('\n')[0],elapsedMs:Math.round(performance.now()-start),progress}));
}
// Same deterministic preparation function invoked by submit_repair, but no AI,
// no signing, and no persistent writes. sim_call exposes the execution error.
for(const site of ['tidal_sluice','creek_bridge']) {
  const row=repairs.find(item=>item.to_address?.toLowerCase()===addresses[site].toLowerCase());
  if(!row)continue;
  const args=abi.calldata.decode(Uint8Array.from(Buffer.from(row.data.calldata,'base64'))).get('args');
  const encoded=abi.calldata.encode(abi.calldata.makeCalldataObject('prepare_repair',[calldataCaller,...args]));
  const data=abi.transactions.serialize([encoded,false]);
  const start=performance.now();
  try {
    const result=await rpc('sim_call',[{type:'read',to:addresses[site],from:caller,data,transaction_hash_variant:'latest-final'}]);
    console.log(JSON.stringify({kind:'read-only-prepare-simulation',site,elapsedMs:Math.round(performance.now()-start),
      execution:result.execution_result,result:result.result,genvmResult:result.genvm_result,stats:result.execution_stats}));
  }catch(error){
    console.log(JSON.stringify({kind:'read-only-prepare-simulation',site,elapsedMs:Math.round(performance.now()-start),error:error.message}));
    // Studio's current parser strips exactly two prefix bytes from long RLP
    // lists, although these calls require three. Its documented implementation
    // also accepts raw calldata when the final byte is nonzero. This bypasses
    // that framing bug, not any contract check; still a view on a snapshot.
    if(/RLP string ends/.test(error.message)&&encoded.at(-1)!==0) {
      const rawStart=performance.now();
      try {
        const result=await rpc('sim_call',[{type:'read',to:addresses[site],from:caller,
          data:abi.transactions.serializeOne(encoded),transaction_hash_variant:'latest-final'}]);
        let preparedSummary;
        if(result.execution_result==='SUCCESS'&&typeof result.result==='string') {
          const decoded=abi.calldata.decode(Uint8Array.from(Buffer.from(result.result,'base64').subarray(1)));
          if(decoded instanceof Map)preparedSummary=Object.fromEntries(['siteId','nonce','technicallyValid','technicalFlags','metrics'].map(key=>[key,decoded.get(key)]));
        }
        console.log(JSON.stringify({kind:'raw-calldata-read-only-prepare',site,elapsedMs:Math.round(performance.now()-rawStart),
          execution:result.execution_result,preparedSummary,genvmResult:result.genvm_result,stats:result.execution_stats},(_,value)=>
            typeof value==='bigint'?value.toString():value instanceof Map?Object.fromEntries(value):value));
      }catch(rawError){console.log(JSON.stringify({kind:'raw-calldata-read-only-prepare',site,elapsedMs:Math.round(performance.now()-rawStart),error:rawError.message}));}
    }
  }
}
