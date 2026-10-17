import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { testnetBradbury } from 'genlayer-js/chains';
import {abi} from 'genlayer-js';
import { TransactionHashVariant } from 'genlayer-js/types';
import { encodeAbiParameters, encodeEventTopics, encodeFunctionData } from 'viem';
import { createGenLayerAdapter, createRepairExampleDraft, digestRepairSubmission, FIXTURE_VERSION, getRepairScenario, REPAIR_SCENARIOS, resolveGenLayerConfig, validateRepairLocally } from '../src/genlayer';
import type { Address, Hash, InjectedProvider, PreparedRepair, RepairReadClient, RepairState } from '../src/genlayer';
import { CONTEXT_FLAGS, submissionData } from '../src/genlayer/evidence';
import { SITE_CONTRACT_META } from '../src/genlayer/site-contract-meta';
import { World } from '../src/domain/world';
import { SMOKE_LEVEL } from '../src/content/smoke-level';
import { parseRecoveryTicket } from '../src/domain/save';
import { boundTickets } from '../src/application/recover-repairs';
import type { VillagePumpDesignId } from '../src/genlayer/council/types';

const caller = `0x${'1'.repeat(40)}` as Address;
const expeditionId = `0x${'e'.repeat(64)}` as Address;
const addresses = Object.fromEntries(REPAIR_SCENARIOS.map((s,i)=>[s.id,`0x${(i+100).toString(16).padStart(40,'0')}` as Address]));
const config = resolveGenLayerConfig({ VITE_GENLAYER_SITE_ADDRESSES: JSON.stringify(addresses) });
const consensus = testnetBradbury.consensusMainContract!;
const outerAbi = [{ type:'function',name:'addTransaction',stateMutability:'nonpayable',inputs:[
  {name:'sender',type:'address'},{name:'recipient',type:'address'},{name:'validators',type:'uint256'},
  {name:'rotations',type:'uint256'},{name:'data',type:'bytes'},{name:'until',type:'uint256'},
],outputs:[] }] as const;

function harness(studio=false) {
  const rpcChainId=studio?61999:4221;
  const nativeChainId=studio?61999:1;
  const harnessConfig=studio?resolveGenLayerConfig({VITE_GENLAYER_SITE_ADDRESSES:JSON.stringify(addresses),VITE_GENLAYER_NETWORK:'studionet'}):config;
  const approved = new Set<string>(), nonces = new Map<string,string>(), disk = new Map<string,string>();
  const control = { status:7, wrongDependency:false, wrongSource:false, crossRecipient:false, nativeChainId:nativeChainId as 1|4221|61999,
    digestNativeChainId:nativeChainId as 1|4221|61999, rpcChain:`0x${rpcChainId.toString(16)}`,
    runtime:'ok' as 'ok'|'timeout'|'invalid', runtimeReads:[] as string[] };
  let prepared:PreparedRepair, recipient:Address, counter=0, evmHash:Hash, txId:Hash;
  let activeReads=0,maxActiveReads=0;
  const progressReads:string[]=[];
  let prepareCalls=0;
  const trackedRead=async<T>(task:()=>T|Promise<T>):Promise<T>=>{
    activeReads++;maxActiveReads=Math.max(maxActiveReads,activeReads);
    try{await new Promise(resolve=>setTimeout(resolve,2));return await task();}
    finally{activeReads--;}
  };
  const history = new Map<Hash,{prepared:PreparedRepair;recipient:Address;txId:Hash;evmHash:Hash}>();
  const siteAt = (address:Address) => REPAIR_SCENARIOS.find(s=>addresses[s.id]!.toLowerCase()===address.toLowerCase())!;
  const publicClient:RepairReadClient = {
    request:async()=>control.rpcChain,
    getContractCode:address=>trackedRead(()=>readFileSync(new URL(`../${SITE_CONTRACT_META[control.wrongSource?'pier_hoist':siteAt(address).id].file}`,import.meta.url),'utf8')),
    readContract:args=>trackedRead(async()=>{
      expect(args.transactionHashVariant).toBe(TransactionHashVariant.LATEST_FINAL);
      expect(args.leaderOnly).toBe(false);
      const site=siteAt(args.address),children=REPAIR_SCENARIOS.filter(child=>child.requires.includes(site.id));
      if(args.functionName==='get_protocol')return {protocolVersion:'repair-v2',fixtureVersion:FIXTURE_VERSION,chainId:control.nativeChainId,architecture:'async-notify-v1',sites:[site.id],
        dependencies:Object.fromEntries(site.requires.map(parent=>[parent,addresses[control.wrongDependency?'ridge_beacon':parent]])),
        dependents:Object.fromEntries(children.map(child=>[child.id,addresses[child.id]])),dependentsConfigured:true};
      if(args.functionName==='get_progress'){progressReads.push(site.id);const confirmed=site.requires.filter(parent=>approved.has(parent));return {expeditionId:String(args.args[1]),nextNonce:nonces.get(site.id)??'0',approvedSiteIds:approved.has(site.id)?[site.id]:[],
        dependencyReady:confirmed.length===site.requires.length,requiredParentSiteIds:[...site.requires],confirmedParentSiteIds:confirmed};}
      if(args.functionName==='prepare_repair'){
        prepareCalls++;
        const draft={siteId:site.id,artifact:JSON.parse(args.args[3] as string),rationale:args.args[4] as string};
        const runId=String(args.args[1]),nonce=String(args.args[5]);const local=validateRepairLocally(site.id,draft.artifact);
        const technicalFlags={...local.flags,dependencies:site.requires.every(p=>approved.has(p)),nonce:nonce===(nonces.get(site.id)??'0'),newSite:!approved.has(site.id)};
        prepared={...draft,caller,expeditionId:runId as typeof expeditionId,nonce,technicalFlags,technicallyValid:Object.values(technicalFlags).every(Boolean),fixtureVersion:FIXTURE_VERSION,
          digest:await digestRepairSubmission({chainId:rpcChainId,nativeChainId:control.digestNativeChainId,contractAddress:args.address,caller,expeditionId:runId as typeof expeditionId,siteId:site.id,nonce,fixtureVersion:FIXTURE_VERSION},draft.artifact,draft.rationale)};
        return prepared;
      }
      if(args.functionName==='get_receipt'){
        const record=[...history.values()].find(r=>r.recipient===args.address&&r.prepared.nonce===String(args.args[2]));
        if(!record)return null;
        const {technicallyValid:_,...body}=record.prepared;
        const design = record.prepared.siteId === 'village_pump'
          ? getRepairScenario('village_pump').technical.designs?.find(candidate =>
            candidate.slotIds.length === record.prepared.artifact.parts.length && candidate.slotIds.every(slot => record.prepared.artifact.parts.some(part => part.slotId === slot)) &&
            candidate.mountZoneId === record.prepared.artifact.configuration.mountZoneId && candidate.outputModeId === record.prepared.artifact.configuration.outputModeId &&
            candidate.routeId === record.prepared.artifact.configuration.routeId)
          : undefined;
        const councilResult = design ? { schemaVersion:'island-council-v2' as const,catalogVersion:'village-pump-council-2' as const,
          siteId:'village_pump' as const,scenarioId:'water-shortage-nesting-season' as const,chosenDesignId:design.id as VillagePumpDesignId,
          decision:'approve' as const,quality:'good' as const } : undefined;
        return {...body,decision:'approved',technicalFlags:body.technicalFlags,contextFlags:Object.fromEntries(CONTEXT_FLAGS.map(f=>[f,true])),
          feedback:'Scripted multisite review.',...(design?{designId:design.id}:{}),
          ...(councilResult?{councilResult,evidenceQuote:'Village water shortage'}:{})};
      }
      throw new Error('Unexpected view');
    }),
    getTransactionReceipt:async ({hash})=>{
      const row=[...history.values()].find(r=>r.evmHash===hash)!;
      return {transactionHash:hash,status:'success',logs:[{address:consensus.address,
        topics:encodeEventTopics({abi:consensus.abi,eventName:'CreatedTransaction',args:{txId:row.txId}}),data:encodeAbiParameters([{type:'uint256'}],[1n])}]};
    },
    getTransaction:async ({hash})=>{
      const row=history.get(hash)!;
      return {txId:hash,sender:caller,recipient:control.crossRecipient?addresses.pier_hoist:row.recipient,txData:submissionData(row.prepared),status:control.status,txExecutionResult:1,resultName:'AGREE'};
    },
  };
  const provider:InjectedProvider={request:vi.fn(async args=>{
    if(args.method==='eth_chainId')return `0x${rpcChainId.toString(16)}`;
    if(args.method==='eth_requestAccounts'||args.method==='eth_accounts')return [caller];
    if(args.method==='eth_sendTransaction'){
      counter++;evmHash=`0x${counter.toString(16).padStart(64,'0')}`;txId=`0x${(counter+100).toString(16).padStart(64,'0')}`;
      history.set(txId,{prepared,recipient,evmHash,txId});return evmHash;
    }
    throw new Error('Unexpected wallet call');
  })};
  const adapter=createGenLayerAdapter(harnessConfig,{publicClient,readTimeoutMs:100,storage:{getItem:k=>disk.get(k)??null,setItem:(k,v)=>{disk.set(k,v);}},maxPolls:1,pollIntervalMs:0,
    writerFactory:(account,guarded)=>({writeContract:async args=>{
      recipient=args.address;
      const site=getRepairScenario(String(args.args[1]));
      const runId=String(args.args[0]),artifact=JSON.parse(args.args[2] as string);
      const rationale=args.args[3] as string,nonce=String(args.args[4]);
      const local=validateRepairLocally(site.id,artifact);
      const technicalFlags={...local.flags,dependencies:site.requires.every(parent=>approved.has(parent)),nonce:nonce===(nonces.get(site.id)??'0'),newSite:!approved.has(site.id)};
      prepared={siteId:site.id,artifact,rationale,caller,expeditionId:runId as typeof expeditionId,nonce,technicalFlags,technicallyValid:Object.values(technicalFlags).every(Boolean),fixtureVersion:FIXTURE_VERSION,
        digest:await digestRepairSubmission({chainId:rpcChainId,nativeChainId:control.digestNativeChainId,contractAddress:args.address,caller,expeditionId:runId as typeof expeditionId,siteId:site.id,nonce,fixtureVersion:FIXTURE_VERSION},artifact,rationale)};
      expect(recipient).toBe(addresses[prepared.siteId]);
      await guarded.request({method:'eth_sendTransaction',params:[{from:account,to:consensus.address,chainId:`0x${rpcChainId.toString(16)}`,value:'0x0',
        data:encodeFunctionData({abi:outerAbi,functionName:'addTransaction',args:[caller,recipient,5n,3n,submissionData(prepared),BigInt(Math.floor(Date.now()/1000)+3600)]})}]});
      return txId;
    }})});
  adapter.setExpedition(expeditionId);
  const states:RepairState[]=[];adapter.subscribe(s=>states.push(s));
  return {adapter,provider,approved,nonces,control,states,progressReads,setPrepared(value:PreparedRepair){prepared=value;},get broadcasts(){return counter;},get prepareCalls(){return prepareCalls;},get maxActiveReads(){return maxActiveReads;},resetReadPeak(){maxActiveReads=activeReads;}};
}

describe('per-site immutable deployment routing',()=>{
  it.each(REPAIR_SCENARIOS.filter(site=>site.requires.length).map(site=>site.id))('fails the deterministic prerequisite flag for %s until parents are finalized',async id=>{
    const h=harness(true);expect((await h.adapter.connect(h.provider)).status).toBe('ready');
    const prepared=await h.adapter.prepare(createRepairExampleDraft(id,'valid'));
    expect(prepared.technicalFlags.dependencies).toBe(false);
    expect(prepared.technicallyValid).toBe(false);
    expect(h.control.runtimeReads).toEqual([]);expect(h.broadcasts).toBe(0);
    expect(h.states.some(state=>state.status==='queued')).toBe(true);h.adapter.dispose();
  });
  it('accepts a dependent preparation only after its parents are finalized, without nested runtime calls',async()=>{
    const h=harness(true);await h.adapter.connect(h.provider);
    for(const parent of getRepairScenario('creek_bridge').requires)h.approved.add(parent);
    expect((await h.adapter.prepare(createRepairExampleDraft('creek_bridge','valid'))).technicallyValid).toBe(true);
    expect(h.control.runtimeReads).toEqual([]);expect(h.broadcasts).toBe(0);
    expect(h.states.some(state=>state.status==='finalized-success')).toBe(false);h.adapter.dispose();
  });
  it('does not run dependency probes for root sites or missing prerequisites',async()=>{
    const h=harness(true);await h.adapter.connect(h.provider);h.control.runtime='timeout';
    for(const site of REPAIR_SCENARIOS.filter(site=>!site.requires.length))await h.adapter.prepare(createRepairExampleDraft(site.id,'valid'));
    expect((await h.adapter.prepare(createRepairExampleDraft('creek_bridge','valid'))).technicallyValid).toBe(false);
    expect(h.control.runtimeReads).toEqual([]);expect(h.broadcasts).toBe(0);h.adapter.dispose();
  });
  it('requires eight distinct addresses and fails closed on incomplete manifests',()=>{
    expect(config.enabled).toBe(true);
    expect(resolveGenLayerConfig({VITE_GENLAYER_SITE_ADDRESSES:'{}'}).enabled).toBe(false);
    expect(resolveGenLayerConfig({VITE_GENLAYER_SITE_ADDRESSES:JSON.stringify({...addresses,ridge_beacon:addresses.pier_hoist})}).enabled).toBe(false);
  });
  it('verifies the eight-site manifest in small RPC batches instead of overwhelming the public node',async()=>{
    const h=harness();
    expect((await h.adapter.connect(h.provider)).status).toBe('ready');
    expect(h.maxActiveReads).toBeLessThanOrEqual(4);
    h.resetReadPeak();
    expect((await h.adapter.getProgress(caller,'pier_hoist')).nextNonce).toBe('0');
    expect(h.maxActiveReads).toBeLessThanOrEqual(2);
    h.adapter.dispose();
  });
  it('prepares and submits the hoist using only its own progress view',async()=>{
    const h=harness();
    expect((await h.adapter.connect(h.provider)).status).toBe('ready');
    const draft=createRepairExampleDraft('pier_hoist','valid');
    const prepared=await h.adapter.prepare(draft);
    h.setPrepared(prepared);
    expect(h.progressReads).toEqual(['pier_hoist']);
    expect(h.prepareCalls).toBe(0);
    expect((await h.adapter.submit(prepared)).status).toBe('finalized-success');
    expect(h.progressReads).toEqual(['pier_hoist','pier_hoist']);
    h.adapter.dispose();
  });
  it.each(['wrongSource','wrongDependency'] as const)('rejects %s before any writes',async failure=>{
    const h=harness();h.control[failure]=true;
    expect((await h.adapter.connect(h.provider)).status).toBe('disabled');h.adapter.dispose();
  });
  it('routes all eight approvals with independent zero nonces and original-address recovery',async()=>{
    const h=harness();expect((await h.adapter.connect(h.provider)).status).toBe('ready');
    const context={caller,contractAddress:addresses.pier_hoist!,chainId:4221 as const,siteAddresses:addresses,expeditionId};
    const world=new World(SMOKE_LEVEL,REPAIR_SCENARIOS,'connected',context);
    const unsubscribe=h.adapter.subscribe(state=>world.enqueueReview(state));
    for(const site of REPAIR_SCENARIOS){
      const prepared=await h.adapter.prepare(createRepairExampleDraft(site.id,'valid'));
      h.setPrepared(prepared);
      expect(prepared.nonce).toBe('0');
      expect(await h.adapter.submit(prepared)).toMatchObject({status:'finalized-success',grant:{contractAddress:addresses[site.id],receipt:{siteId:site.id,nonce:'0'}}});
      h.approved.add(site.id);h.nonces.set(site.id,'1');
      for(let step=0;step<190;step++)world.tick(1/60,[]);
      expect(world.snapshot().restoredSiteIds).toContain(site.id);
    }
    const evidence=h.adapter.getApprovalEvidence(caller);
    expect(evidence).toHaveLength(8);
    const pump=evidence[1]!;
    expect(parseRecoveryTicket({version:pump.version,chainId:pump.chainId,contractAddress:pump.contractAddress,prepared:pump.prepared,evmTxHash:pump.evmTxHash,txId:pump.txId},REPAIR_SCENARIOS[1]!,context).contractAddress).toBe(addresses.village_pump);
    expect(boundTickets(h.adapter,{owner:world,context,epoch:1},[pump])).toEqual([pump]);
    expect(()=>parseRecoveryTicket({...pump,kind:undefined,contractAddress:addresses.pier_hoist},REPAIR_SCENARIOS[1]!,context)).toThrow();
    expect(await h.adapter.reverifyApproval(evidence[7]!)).toMatchObject({status:'finalized-success',grant:{contractAddress:addresses.ridge_beacon}});
    expect((await h.adapter.getProgress(caller,'ridge_beacon')).approvedSiteIds).toHaveLength(8);
    unsubscribe();
    const reloaded=new World(SMOKE_LEVEL,REPAIR_SCENARIOS,'connected',context);
    reloaded.restoreSave(world.exportSave());
    expect(reloaded.snapshot().restoredSiteIds).toEqual([]);
    const resubscribe=h.adapter.subscribe(state=>reloaded.enqueueReview(state));
    for(const proof of evidence){
      expect((await h.adapter.reverifyApproval(proof)).status).toBe('finalized-success');
      for(let step=0;step<190;step++)reloaded.tick(1/60,[]);
    }
    expect(reloaded.snapshot().restoredSiteIds).toHaveLength(8);resubscribe();
    h.adapter.dispose();
  });
  it('does not award provisional accepted state or accept another site recipient',async()=>{
    const h=harness();await h.adapter.connect(h.provider);h.control.status=5;
    const p=await h.adapter.prepare(createRepairExampleDraft('village_pump','valid'));
    h.setPrepared(p);
    expect((await h.adapter.submit(p)).status).toBe('timed-out');
    expect(h.states.some(s=>s.status==='finalized-success')).toBe(false);
    h.control.status=7;h.control.crossRecipient=true;
    expect((await h.adapter.resume(h.adapter.getRecoveryTickets(caller)[0]!)).status).toBe('recovery-needed');
    h.adapter.dispose();
  });
  it('pins native context 1 without accepting RPC chain 1 or wrong-context digests',async()=>{
    const wrongRpc=harness();wrongRpc.control.rpcChain='0x1';
    expect((await wrongRpc.adapter.connect(wrongRpc.provider)).status).toBe('disabled');wrongRpc.adapter.dispose();
    const wrongNative=harness();wrongNative.control.nativeChainId=4221;
    expect((await wrongNative.adapter.connect(wrongNative.provider)).status).toBe('disabled');wrongNative.adapter.dispose();
    const digestBinding=harness();expect((await digestBinding.adapter.connect(digestBinding.provider)).status).toBe('ready');
    const prepared=await digestBinding.adapter.prepare(createRepairExampleDraft('pier_hoist','valid'));
    expect(prepared.digest).toBe(await digestRepairSubmission({chainId:4221,nativeChainId:1,contractAddress:addresses.pier_hoist!,caller,expeditionId,siteId:'pier_hoist',nonce:'0',fixtureVersion:FIXTURE_VERSION},prepared.artifact,prepared.rationale));
    expect(vi.mocked(digestBinding.provider.request).mock.calls.some(([args])=>args.method==='eth_sendTransaction')).toBe(false);
    digestBinding.adapter.dispose();
  });
});
