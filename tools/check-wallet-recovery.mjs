// Reads existing public StudioNet transactions through this working tree's adapter.
// The provider stub supplies an address for reads and rejects every signing call.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {execFileSync} from 'node:child_process';
const caller=process.argv[2];
assert.match(caller??'',/^0x[0-9a-fA-F]{40}$/);
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
let adapter;
try {
  const {createGenLayerAdapter,resolveGenLayerConfig,REPAIR_SCENARIOS}=await server.ssrLoadModule('/src/genlayer/index.ts');
  const {STUDIONET_SITE_ADDRESSES}=await server.ssrLoadModule('/src/genlayer/deployments.ts');
  const {World}=await server.ssrLoadModule('/src/domain/world.ts');
  const {SMOKE_LEVEL}=await server.ssrLoadModule('/src/content/smoke-level.ts');
  const {recoverRepairs}=await server.ssrLoadModule('/src/application/recover-repairs.ts');
  const config=resolveGenLayerConfig({VITE_GENLAYER_NETWORK:'studionet',VITE_GENLAYER_SITE_ADDRESSES:JSON.stringify(STUDIONET_SITE_ADDRESSES)});
  const context={caller:caller.toLowerCase(),contractAddress:config.contractAddress,chainId:61999,siteAddresses:config.siteAddresses};
  const world=new World(SMOKE_LEVEL,REPAIR_SCENARIOS,'connected',context),session={owner:world,context,epoch:1};
  const states=[],deadline=new AbortController(),timer=setTimeout(()=>deadline.abort(),120000);
  const disk=new Map();
  adapter=createGenLayerAdapter(config,{storage:{getItem:key=>disk.get(key)??null,setItem:(key,value)=>{disk.set(key,value);}},maxPolls:1,readTimeoutMs:20000});
  adapter.subscribe(state=>{
    world.enqueueReview(state);world.tick(1/60,[]);
    if(state.status==='finalized-success')for(let i=0;i<181;i++)world.tick(1/60,[]);
    if(state.status==='finalized-success')states.push({siteId:state.grant.receipt.siteId,status:state.status,txId:state.grant.txId,digest:state.grant.receipt.digest,decision:state.grant.receipt.decision});
    else if('ticket'in state&&state.ticket)states.push({siteId:state.ticket.prepared.siteId,status:state.status,...('reason'in state?{reason:state.reason}:{}),...('message'in state?{message:state.message}:{})});
  });
  try {
    const connection=await adapter.connect({request:async({method})=>{
      if(method==='eth_requestAccounts'||method==='eth_accounts')return [context.caller];
      if(method==='eth_chainId')return '0xf22f';
      throw new Error(`Signing is forbidden in this read-only check: ${method}`);
    }});
    assert.equal(connection.status,'ready',JSON.stringify(connection));
    const discovered=await adapter.discoverRecovery(context.caller,deadline.signal);
    const checked=await recoverRepairs(adapter,'all',session,()=>session,{
      restored:()=>world.snapshot().restoredSiteIds,savedTickets:()=>[],
      waitForRestored:async(id)=>assert.ok(world.snapshot().restoredSiteIds.includes(id),`Verified grant was not installed: ${id}`),
    },deadline.signal);
    const snapshot=world.snapshot(),bridge=snapshot.sites.find(site=>site.id==='creek_bridge');
    const report={scope:'Read-only live StudioNet recovery through the local working-tree adapter using a public wallet address; no real-browser wallet approval or new transaction',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingTreeBackendModified:!!execFileSync('git',['status','--porcelain','--','src/genlayer'],{encoding:'utf8'}).trim(),checkedAt:new Date().toISOString(),chainId:61999,caller:context.caller,discovered:discovered.map(ticket=>({siteId:ticket.prepared.siteId,txId:ticket.txId})),checked,states,restoredSiteIds:snapshot.restoredSiteIds,pendingTickets:adapter.getRecoveryTickets(context.caller).map(ticket=>ticket.evmTxHash),bridge:{phase:bridge.phase,hasSavedBuild:!!bridge.draft?.artifact.parts.length,hasPendingTicket:!!bridge.ticket}};
    if(process.argv.includes('--expect-bridge-retry')) {
      assert.deepEqual(snapshot.restoredSiteIds,['pier_hoist','village_pump','tidal_sluice']);
      assert.equal(bridge.phase,'revision');assert.equal(bridge.ticket,null);assert.equal(report.pendingTickets.length,0);
      const prepared=await adapter.prepare(bridge.draft);
      report.bridgePreflight={nonce:prepared.nonce,technicallyValid:prepared.technicallyValid,technicalFlags:prepared.technicalFlags};
      assert.equal(prepared.technicallyValid,true,'Live Bridge prerequisites/preflight failed');
    }
    if(process.argv.includes('--expect-runtime-block')) {
      assert.deepEqual(snapshot.restoredSiteIds,['pier_hoist','village_pump','tidal_sluice']);
      assert.equal(report.pendingTickets.length,0);
      let blocked;
      try{await adapter.prepare(bridge.draft);}catch(error){blocked=error;}
      assert.equal(blocked?.code,'RUNTIME_UNAVAILABLE','Expected the actual nested runtime check to stop before a submission');
      report.bridgeRuntimeGate={status:'blocked-before-signing',code:blocked.code,message:blocked.message,
        noNewTransaction:true,noApprovalGranted:true};
    }
    console.log(JSON.stringify(report,null,2));
    if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(report,null,2)+'\n');
  }finally{clearTimeout(timer);}
}finally{adapter?.dispose();await server.close();}
