// One genuine testnet repair using the already-authorized CLI account.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { CalldataAddress, TransactionHashVariant } from 'genlayer-js/types';
export default async function review(cliClient) {
  const root = resolve('../..');
  const out = resolve(root, 'artifacts/deployment/live-review.json');
  if (existsSync(out) && JSON.parse(readFileSync(out, 'utf8')).txId) throw new Error('Existing review broadcast: inspect it; do not submit twice.');
  const account = cliClient.account;
  if (account?.address?.toLowerCase() !== '0x797d3b25fb2cca0ff93f60df1910267f3822d655') throw new Error('Unexpected CLI account');
  const client = createClient({ chain: testnetBradbury, account });
  if (Number(await client.request({ method: 'eth_chainId' })) !== 4221) throw new Error('Wrong network');
  const deployment = JSON.parse(readFileSync(resolve(root,'artifacts/deployment/sites/pier_hoist.json'),'utf8'));
  const address = deployment.address;
  const caller = new CalldataAddress(Uint8Array.from(Buffer.from(account.address.slice(2), 'hex')));
  const read = (functionName,args) => client.readContract({ address,functionName,args,leaderOnly:false,jsonSafeReturn:true,transactionHashVariant:TransactionHashVariant.LATEST_FINAL });
  const fixture = JSON.parse(readFileSync(resolve(root,'tests/direct/genlayer-cases.json'),'utf8'))[0];
  const progress = await read('get_progress',[caller]);
  if (progress.approvedSiteIds.includes(fixture.siteId)) throw new Error('This account already completed the test site.');
  const args = [fixture.siteId,JSON.stringify(fixture.artifact),fixture.rationale,BigInt(progress.nextNonce)];
  const prepared = await read('prepare_repair',[caller,...args]);
  if (!prepared.technicallyValid) throw new Error('Live technical preflight failed');
  let evidence = { network:'testnetBradbury',chainId:4221,account:account.address,address,site:fixture.siteId,prepared };
  const save = () => writeFileSync(out,JSON.stringify(evidence,(_,v)=>typeof v==='bigint'?v.toString():v,2));
  save();
  console.log(JSON.stringify({ action:'live review',site:fixture.siteId,technicallyValid:true,digest:prepared.digest }));
  const txId = await client.writeContract({ address,functionName:'submit_repair',args,value:0n,leaderOnly:false });
  evidence = {...evidence,txId}; save();
  console.log(JSON.stringify({txId,state:'submitted'}));
  const receipt = await client.waitForTransactionReceipt({ hash:txId,status:'ACCEPTED',retries:50,interval:3000 });
  evidence = {...evidence,transaction:receipt}; save();
  console.log(JSON.stringify({txId,status:receipt.status,execution:receipt.txExecutionResult,result:receipt.result}));
}
