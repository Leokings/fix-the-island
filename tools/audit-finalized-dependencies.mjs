// Read-only source/protocol audit. Never submits or simulates gameplay writes.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createClient} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {TransactionHashVariant} from 'genlayer-js/types';
const manifest=JSON.parse(readFileSync('contracts/sites/manifest.json','utf8'));
const addresses=JSON.parse(readFileSync('src/genlayer/deployments.studionet.json','utf8'));
const client=createClient({chain:studionet});
assert.equal(Number(await client.request({method:'eth_chainId'})),61999);
const sites=[];
for(const [site,entry] of Object.entries(manifest)) {
  const address=addresses[site];
  const source=await client.getContractCode(address);
  const sourceHash='0x'+createHash('sha256').update(source.replace(/\r\n/g,'\n')).digest('hex');
  const protocol=await client.readContract({address,functionName:'get_protocol',args:[],leaderOnly:false,
    jsonSafeReturn:true,transactionHashVariant:TransactionHashVariant.LATEST_FINAL});
  assert.equal(sourceHash,entry.codeHash);
  assert.deepEqual(protocol.dependencies,Object.fromEntries(entry.requires.map(parent=>[parent,addresses[parent].toLowerCase()])));
  const requiresFinalizedCrossContractRead=entry.requires.length>0;
  if(requiresFinalizedCrossContractRead)assert.ok(source.includes('view(state=StorageType.LATEST_FINAL).get_site_approval'));
  const row={site,address,sourceHash,sourceMatchesLocal:true,requires:entry.requires,
    requiresFinalizedCrossContractRead,preSubmitRuntimeGuard:requiresFinalizedCrossContractRead,
    action:requiresFinalizedCrossContractRead?'Studio host finalized-read fix required; verify before signing':'No affected prerequisite-read path'};
  sites.push(row);console.log(JSON.stringify(row));
}
const report={checkedAt:new Date().toISOString(),chainId:61999,rpcUrl:studionet.rpcUrls.default.http[0],
  scope:'Deployed source and protocol bindings; no gameplay writes or new consensus tests',
  upstreamFix:'https://github.com/genlayerlabs/genlayer-studio/pull/1792',hostPatched:false,
  note:'preSubmitRuntimeGuard describes the local code change, not a production deployment',sites};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
