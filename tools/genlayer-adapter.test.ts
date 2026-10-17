import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { abi, createClient } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { CalldataAddress, TransactionHashVariant } from 'genlayer-js/types';
import { decodeFunctionData, encodeAbiParameters, encodeEventTopics, encodeFunctionData, TransactionReceiptNotFoundError } from 'viem';
import { createGenLayerAdapter, createRepairArtifact, createRepairExampleDraft, digestRepairSubmission, FIXTURE_VERSION, GenLayerClientError,
  getRepairScenario, REPAIR_SCENARIOS, resolveGenLayerConfig, validateRepairLocally } from '../src/genlayer';
import type { ApprovalEvidence, GenLayerAdapterOptions, Hash, InjectedProvider, PreparedRepair, RecoveryTicket, RepairReadClient, RepairState, RepairWriteClient } from '../src/genlayer';
import { CONTEXT_FLAGS, submissionData, submissionArgs, transactionEvidence } from '../src/genlayer/evidence';
import { SITE_CONTRACT_META } from '../src/genlayer/site-contract-meta';
import type { VillagePumpDesignId } from '../src/genlayer/council/types';

const caller = `0x${'1'.repeat(40)}` as const, other = `0x${'3'.repeat(40)}` as const, contractAddress = `0x${'2'.repeat(40)}` as const;
const evmTxHash = `0x${'a'.repeat(64)}` as const, txId = `0x${'b'.repeat(64)}` as const;
const expeditionId = `0x${'e'.repeat(64)}` as Hash;
const siteAddresses = Object.freeze(Object.fromEntries(REPAIR_SCENARIOS.map((site,index)=>[site.id,index===0?contractAddress:`0x${(index+20).toString(16).padStart(40,'0')}`])));
const addressFor=(siteId:string)=>siteAddresses[siteId as keyof typeof siteAddresses]!;
const siteFor=(address:string)=>REPAIR_SCENARIOS.find(site=>addressFor(site.id).toLowerCase()===address.toLowerCase())!;
const consensus = testnetBradbury.consensusMainContract!;
const config = resolveGenLayerConfig({ VITE_GENLAYER_SITE_ADDRESSES: JSON.stringify(siteAddresses) });
describe('network configuration', () => {
  it('selects the hosted stable Studionet with its matching chain ID and RPC', () => {
    expect(resolveGenLayerConfig({ VITE_GENLAYER_SITE_ADDRESSES: JSON.stringify(siteAddresses), VITE_GENLAYER_NETWORK: 'studionet' }))
      .toMatchObject({ enabled: true, network: 'studionet', chainId: 61999, rpcUrl: 'https://studio.genlayer.com/api' });
  });
});
const outerAbi = [{ type: 'function', name: 'addTransaction', stateMutability: 'nonpayable', inputs: [
  { name: '_sender', type: 'address' }, { name: '_recipient', type: 'address' }, { name: '_numOfInitialValidators', type: 'uint256' },
  { name: '_maxRotations', type: 'uint256' }, { name: '_txData', type: 'bytes' },
], outputs: [] }] as const;

/** All RPC, wallet and contextual outcomes here are explicit test-only scripts. */
function harness(opts: GenLayerAdapterOptions = {}) {
  const disk = new Map<string, string>(), callbacks = new Map<string, (...args: unknown[]) => void>();
  const broadcasts = new Map<Hash, { txId: Hash; prepared: PreparedRepair }>();
  const originalCalls = new Map<Hash, PreparedRepair>(), originalReceipts = new Map<string, PreparedRepair>();
  const storage = { getItem: vi.fn((key: string) => disk.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { disk.set(key, value); }) };
  const control = { wallet: caller as string, chain: '0x107d', statuses: [7], executions: [1] as (number | undefined)[],
    protocolVersion: 'repair-v2', fixtureVersion: FIXTURE_VERSION, code: '', nextNonce: '0', approvedSiteIds: [] as string[],
    decision: 'approved', contextFlags: Object.fromEntries(CONTEXT_FLAGS.map((name) => [name, true])),
    missingRecord: false, evmMissing: false, evmReverted: false, recordChanges: {} as Record<string, unknown>, txChanges: {} as Record<string, unknown>,
    prepared: undefined as PreparedRepair | undefined, afterBroadcast: undefined as (() => void) | undefined,
    walletError: undefined as unknown, keepSdkWaiting: false, receiptEventAddress: consensus.address,
    evmTxHash: evmTxHash as Hash, txId: txId as Hash,
  };
  let index = 0;
  const read: RepairReadClient = {
    request: vi.fn(async () => '0x107d'), getContractCode: vi.fn(async (address) => control.code || readFileSync(new URL(`../${SITE_CONTRACT_META[siteFor(address).id].file}`,import.meta.url),'utf8')),
    readContract: vi.fn(async (args) => {
      expect(args.transactionHashVariant).toBe(TransactionHashVariant.LATEST_FINAL);
      expect(args.leaderOnly).toBe(false);
      const site=siteFor(args.address),children=REPAIR_SCENARIOS.filter(child=>child.requires.includes(site.id));
      if (args.functionName === 'get_protocol') return { protocolVersion: control.protocolVersion, fixtureVersion: control.fixtureVersion, chainId: 1,
        sites: [site.id],architecture:'async-notify-v1',dependencies:Object.fromEntries(site.requires.map(parent=>[parent,addressFor(parent)])),
        dependents:Object.fromEntries(children.map(child=>[child.id,addressFor(child.id)])),dependentsConfigured:true };
      if (args.functionName === 'get_progress') { expect(args.args[0]).toBeInstanceOf(CalldataAddress); const confirmed=site.requires.filter(parent=>control.approvedSiteIds.includes(parent));
        return { expeditionId:String(args.args[1]),nextNonce:control.nextNonce,approvedSiteIds:control.approvedSiteIds.includes(site.id)?[site.id]:[],
          dependencyReady:confirmed.length===site.requires.length,requiredParentSiteIds:[...site.requires],confirmedParentSiteIds:confirmed }; }
      if (args.functionName === 'prepare_repair') {
        expect(args.args[0]).toBeInstanceOf(CalldataAddress);
        const expeditionId=String(args.args[1]),siteId = args.args[2] as string, artifact = JSON.parse(args.args[3] as string), rationale = args.args[4] as string, nonce = String(args.args[5]);
        const local = validateRepairLocally(siteId, artifact), site = getRepairScenario(siteId);
        const technicalFlags = { ...local.flags, dependencies: site.requires.every((id) => control.approvedSiteIds.includes(id)), nonce: nonce === control.nextNonce, newSite: !control.approvedSiteIds.includes(siteId) };
        const digest = await digestRepairSubmission({ chainId: 4221,nativeChainId:1,contractAddress:args.address,caller: control.wallet as typeof caller,expeditionId:expeditionId as Hash,fixtureVersion: FIXTURE_VERSION, siteId, nonce }, artifact, rationale);
        control.prepared = { siteId, artifact, rationale, nonce, digest, caller: control.wallet as typeof caller,expeditionId:expeditionId as Hash, fixtureVersion: FIXTURE_VERSION, technicalFlags, technicallyValid: Object.values(technicalFlags).every(Boolean) };
        return control.prepared;
      }
      if (args.functionName === 'get_receipt') {
        if (control.missingRecord) return null;
        expect(args.args[0]).toBeInstanceOf(CalldataAddress);
        const original = originalReceipts.get(`${String(args.address).toLowerCase()}:${String(args.args[2])}`);
        if (!original) return null;
        const { technicallyValid: _, ...draft } = original;
        const design = original.siteId === 'village_pump'
          ? getRepairScenario('village_pump').technical.designs?.find(candidate =>
            candidate.slotIds.length === original.artifact.parts.length && candidate.slotIds.every(slot => original.artifact.parts.some(part => part.slotId === slot)) &&
            candidate.mountZoneId === original.artifact.configuration.mountZoneId && candidate.outputModeId === original.artifact.configuration.outputModeId &&
            candidate.routeId === original.artifact.configuration.routeId)
          : undefined;
        const councilResult = design ? {
          schemaVersion: 'island-council-v2' as const, catalogVersion: 'village-pump-council-2' as const,
          siteId: 'village_pump' as const, scenarioId: 'water-shortage-nesting-season' as const, chosenDesignId: design.id as VillagePumpDesignId,
          decision: control.decision === 'approved' ? 'approve' as const : 'revise' as const,
          quality: control.decision === 'approved' ? 'good' as const : null,
        } : undefined;
        return { ...draft, decision: control.decision, contextFlags: control.contextFlags,
          feedback: 'Scripted offline contextual outcome.', ...(design ? { designId: design.id } : {}),
          ...(councilResult ? { councilResult, evidenceQuote: 'Village water shortage' } : {}),
          ...control.recordChanges };
      }
      throw new Error('Unexpected test view.');
    }),
    getTransactionReceipt: vi.fn(async ({ hash }) => {
      const original = broadcasts.get(hash);
      if (control.evmMissing || !original) throw new TransactionReceiptNotFoundError({ hash });
      return { transactionHash: hash, status: control.evmReverted ? 'reverted' : 'success', logs: [{ address: control.receiptEventAddress,
        topics: encodeEventTopics({ abi: consensus.abi, eventName: 'CreatedTransaction', args: { txId: original.txId } }),
        data: encodeAbiParameters([{ type: 'uint256' }], [1n]) }] };
    }),
    getTransaction: vi.fn(async ({ hash }) => {
      const cursor = index++;
      const original = originalCalls.get(hash);
      if (!original) throw new Error('No original offline transaction for this ID.');
      return { txId: hash, sender: original.caller, recipient: addressFor(original.siteId), txData: submissionData(original),
        status: control.statuses[Math.min(cursor, control.statuses.length - 1)], txExecutionResult: control.executions[Math.min(cursor, control.executions.length - 1)],
        resultName: 'AGREE', ...control.txChanges };
    }),
  };
  const provider: InjectedProvider = { request: vi.fn(async (args) => {
    if (args.method === 'eth_requestAccounts' || args.method === 'eth_accounts') return [control.wallet];
    if (args.method === 'eth_chainId') return control.chain;
    if (args.method === 'wallet_switchEthereumChain') { control.chain = '0x107d'; return null; }
    if (args.method === 'wallet_addEthereumChain') return null;
    if (args.method === 'eth_sendTransaction') {
      if (control.walletError) throw control.walletError;
      broadcasts.set(control.evmTxHash, { txId: control.txId, prepared: control.prepared! });
      originalCalls.set(control.txId, control.prepared!);
        originalReceipts.set(`${addressFor(control.prepared!.siteId).toLowerCase()}:${control.prepared!.nonce}`, control.prepared!);
      control.afterBroadcast?.(); return control.evmTxHash;
    }
    throw new Error('Unexpected test wallet method.');
  }), on: (event, callback) => { callbacks.set(event, callback); }, removeListener: (event) => { callbacks.delete(event); } };
  const writerFactory = vi.fn((account, guarded): RepairWriteClient => ({ writeContract: async (args) => {
    expect(String(args.address).toLowerCase()).toBe(addressFor(control.prepared!.siteId).toLowerCase()); expect(args.functionName).toBe('submit_repair'); expect(args.value).toBe(0n); expect(args.leaderOnly).toBe(false);
    expect(args.args).toEqual(submissionArgs(control.prepared!));
    const data = abi.transactions.serialize([abi.calldata.encode(abi.calldata.makeCalldataObject(args.functionName, args.args, undefined)), false]);
    await guarded.request({ method: 'eth_sendTransaction', params: [{ from: account, to: consensus.address,
      data: encodeFunctionData({ abi: outerAbi, functionName: 'addTransaction', args: [account, args.address, 5n, 3n, data] }), value: '0x0', chainId: '0x107d' }] });
    if (control.keepSdkWaiting) return new Promise<Hash>(() => {});
    return control.txId;
  } }));
  const options = { publicClient: read, writerFactory, storage, maxPolls: 3, pollIntervalMs: 0, readTimeoutMs: 100, sleep: vi.fn(async () => {}), ...opts };
  const makeAdapter = (adapterOptions = options) => { const value=createGenLayerAdapter(config, adapterOptions); value.setExpedition(expeditionId); return value; };
  const adapter = makeAdapter(), observed: RepairState[] = [];
  adapter.subscribe((state) => { observed.push(state); if(state.status==='queued')control.prepared=state.prepared; });
  return { adapter, makeAdapter, read, provider, control, storage, disk, observed, writerFactory, options,
    event: (name: string) => { callbacks.get(name)?.(); },
    prepare: async () => { expect(await adapter.connect(provider)).toMatchObject({ status: 'ready', wallet: control.wallet }); return adapter.prepare(createRepairExampleDraft('pier_hoist', 'valid')); },
  };
}

describe('real lifecycle adapter with scripted offline evidence', () => {
  it('accepts the current Studionet finalized-transaction receipt shape only on successful consensus execution', async () => {
    const h = harness();
    const prepared = await h.prepare();
    const ticket: RecoveryTicket = { version: 2, chainId: 61999, contractAddress,
      prepared, evmTxHash, txId };
    const tx = { tx_id: txId, sender: caller, recipient: contractAddress, tx_data: submissionData(prepared).slice(2),
      status: 7, status_name: 'FINALIZED', result_name: 'MAJORITY_AGREE', consensus_data: { leader_receipt: [
        { execution_result: 'SUCCESS', genvm_result: { error_code: null } },
      ] } };
    expect(transactionEvidence(tx, ticket)).toEqual({ status: 'FINALIZED', execution: 'SUCCEEDED',consensusResult:'MAJORITY_AGREE' });
    expect(transactionEvidence({ ...tx, result_name: 'MAJORITY_DISAGREE' }, ticket).execution).toBe('FAILED');
    h.adapter.dispose();
  });

  it('requires the per-site contract set and leaves boot/configuration read-only', async () => {
    const h = harness();
    expect(h.adapter.getState()).toEqual({ status: 'disconnected' });
    expect(h.adapter.config).toMatchObject({ enabled: true, siteAddresses });
    expect(await h.adapter.getScenarios()).toHaveLength(8);
    expect(h.read.request).not.toHaveBeenCalled(); expect(h.provider.request).not.toHaveBeenCalled(); expect(h.writerFactory).not.toHaveBeenCalled();
    h.adapter.dispose();
  });

  it('emits queued/wallet/submitted/pending/accepted/finalized/approved without relying on duration or SDK return', async () => {
    const h = harness(); h.control.statuses = [1, 5, 7]; h.control.keepSdkWaiting = true;
    const prepared = await h.prepare();
    expect(await h.adapter.submit(prepared)).toMatchObject({ status: 'finalized-success', decision: 'approved', grant: {
      mode: 'connected', finality: 'FINALIZED', execution: 'SUCCEEDED', txId, chainId: 4221, contractAddress,
      receipt: { digest: prepared.digest, caller, siteId: 'pier_hoist', nonce: '0', artifact: prepared.artifact },
    } });
    expect(h.observed.map((state) => state.status)).toEqual(['disconnected', 'disconnected', 'ready', 'queued', 'awaiting-wallet', 'submitted', 'pending', 'accepted', 'finalized', 'finalized-success']);
    const broadcast = h.observed.find((state) => state.status === 'submitted')!;
    expect(broadcast).toHaveProperty('ticket.evmTxHash', evmTxHash);
    expect(h.storage.setItem).toHaveBeenCalled();
    expect(h.adapter.getRecoveryTickets(caller)).toEqual([]);
    const methods = vi.mocked(h.provider.request).mock.calls.map(([args]) => args.method);
    expect(methods.filter((method) => method === 'eth_sendTransaction')).toHaveLength(1);
    expect(methods).not.toContain('wallet_requestSnaps'); expect(methods).not.toContain('personal_sign');
    h.adapter.dispose();
  });

  it('accepted execution failure never restores and finalized execution failure is explicit', async () => {
    const h = harness(); h.control.statuses = [5, 7]; h.control.executions = [2];
    expect(await h.adapter.submit(await h.prepare())).toMatchObject({ status: 'failed', reason: 'execution' });
    expect(h.observed.some((state) => state.status === 'accepted')).toBe(true);
    expect(h.observed.some((state) => state.status === 'finalized-success')).toBe(false);
    expect(vi.mocked(h.read.readContract).mock.calls.some(([args]) => args.functionName === 'get_receipt')).toBe(false);
    h.adapter.dispose();
  });

  it('rejection contains the exact original draft for revision, not a completion', async () => {
    const h = harness(); h.control.decision = 'rejected'; h.control.contextFlags.protectsHabitat = false;
    const prepared = await h.prepare();
    expect(await h.adapter.submit(prepared)).toMatchObject({ status: 'rejected', finality: 'FINALIZED', execution: 'SUCCEEDED', receipt: { artifact: prepared.artifact, rationale: prepared.rationale, decision: 'rejected' } });
    h.adapter.dispose();
  });

  it('times out as pending, prohibits duplicate signing, and recovers EVM-only tickets after reload', async () => {
    const h = harness(); h.control.evmMissing = true;
    const result = await h.adapter.submit(await h.prepare());
    expect(result).toMatchObject({ status: 'timed-out', pending: true, lastObservedStatus: 'SUBMITTED' });
    expect(h.read.getTransactionReceipt).toHaveBeenCalledTimes(3); expect(h.read.getTransaction).not.toHaveBeenCalled();
    const [ticket] = h.adapter.getRecoveryTickets(caller); expect(ticket?.txId).toBeUndefined();
    const duplicate = await h.adapter.prepare(createRepairExampleDraft('pier_hoist', 'valid'));
    await expect(h.adapter.submit(duplicate)).rejects.toMatchObject({ code: 'BUSY' });
    h.adapter.dispose(); h.control.evmMissing = false;
    const reloaded = h.makeAdapter();
    await reloaded.connect(h.provider);
    const loaded = reloaded.getRecoveryTickets(caller); expect(loaded).toHaveLength(1);
    expect(reloaded.getState()).toMatchObject({ status: 'ready' }); // no automatic adoption
    expect(await reloaded.resume(loaded[0]!)).toMatchObject({ status: 'finalized-success' });
    expect(h.writerFactory).toHaveBeenCalledTimes(1);
    reloaded.dispose();
  });

  it('archives only original broadcast evidence and rechecks an approval after adapter reload without signing', async () => {
    const h = harness(), prepared = await h.prepare();
    expect(await h.adapter.submit(prepared)).toMatchObject({ status: 'finalized-success' });
    expect(h.adapter.getRecoveryTickets(caller)).toEqual([]);
    const original = h.adapter.getApprovalEvidence(caller)[0]!;
    expect(original).toEqual({ kind: 'approved-broadcast-v1', version: 2, chainId: 4221, contractAddress, prepared, evmTxHash, txId });
    expect(Object.isFrozen(original)).toBe(true);
    expect(Object.isFrozen(original.prepared.artifact)).toBe(true);
    expect(original).not.toHaveProperty('receipt'); expect(original).not.toHaveProperty('contextFlags');
    h.adapter.dispose();
    const reloaded = h.makeAdapter();
    expect(reloaded.getState()).toEqual({ status: 'disconnected' });
    await reloaded.connect(h.provider);
    vi.mocked(h.provider.request).mockClear(); vi.mocked(h.read.readContract).mockClear();
    vi.mocked(h.read.getTransactionReceipt).mockClear(); vi.mocked(h.read.getTransaction).mockClear();
    const loaded = reloaded.getApprovalEvidence(caller);
    expect(loaded).toEqual([original]); expect(reloaded.getState()).toMatchObject({ status: 'ready' });
    expect(h.read.readContract).not.toHaveBeenCalled(); expect(h.read.getTransaction).not.toHaveBeenCalled();
    expect(await reloaded.reverifyApproval(loaded[0]!)).toMatchObject({ status: 'finalized-success', grant: {
      finality: 'FINALIZED', execution: 'SUCCEEDED', txId, receipt: { siteId: 'pier_hoist', caller, digest: prepared.digest, artifact: prepared.artifact },
    } });
    expect(h.read.getTransactionReceipt).toHaveBeenCalledWith({ hash: evmTxHash });
    expect(h.read.getTransaction).toHaveBeenCalledWith({ hash: txId });
    expect(vi.mocked(h.read.readContract).mock.calls.map(([args]) => args.functionName)).toEqual(['get_receipt']);
    expect(vi.mocked(h.provider.request).mock.calls.every(([args]) => args.method === 'eth_accounts' || args.method === 'eth_chainId')).toBe(true);
    expect(h.writerFactory).toHaveBeenCalledTimes(1);
    expect(reloaded.getRecoveryTickets(caller)).toEqual([]);
    expect(reloaded.getApprovalEvidence(caller)).toEqual([original]);
    reloaded.dispose();
  });

  it('hydrates all eight archived original approvals in fixed dependency order using public reads only', async () => {
    const h = harness(); await h.adapter.connect(h.provider);
    const originals: ApprovalEvidence[] = [];
    for (const [index, site] of REPAIR_SCENARIOS.entries()) {
      h.control.evmTxHash = `0x${'a'.repeat(63)}${(index + 1).toString(16)}`;
      h.control.txId = `0x${'b'.repeat(63)}${(index + 1).toString(16)}`;
      const prepared = await h.adapter.prepare(createRepairExampleDraft(site.id, 'valid'));
      expect(prepared.technicallyValid).toBe(true);
      h.control.prepared=prepared;
      const submission=await h.adapter.submit(prepared);
      expect(submission).toMatchObject({ status: 'finalized-success' });
      originals.push(h.adapter.getApprovalEvidence(caller).find((proof) => proof.prepared.siteId === site.id)!);
      h.control.approvedSiteIds.push(site.id); h.control.nextNonce = '0';
    }
    expect(h.adapter.getRecoveryTickets(caller)).toEqual([]);
    const entry = [...h.disk.entries()].find(([key]) => key.endsWith(':approved-broadcast-v2'))!;
    h.disk.set(entry[0], JSON.stringify([...JSON.parse(entry[1])].reverse())); // cache order is not a dependency order
    h.adapter.dispose();
    const reloaded = h.makeAdapter(); await reloaded.connect(h.provider);
    vi.mocked(h.provider.request).mockClear(); vi.mocked(h.writerFactory).mockClear();
    const verified: string[] = [], proofs = reloaded.getApprovalEvidence(caller);
    expect(proofs).toEqual(originals); expect(proofs).toHaveLength(8);
    for (const proof of proofs) {
      expect(getRepairScenario(proof.prepared.siteId).requires.every((id) => verified.includes(id))).toBe(true);
      const state = await reloaded.reverifyApproval(proof);
      expect(state).toMatchObject({ status: 'finalized-success', grant: { txId: proof.txId, receipt: { digest: proof.prepared.digest, nonce: proof.prepared.nonce } } });
      if (state.status === 'finalized-success') verified.push(state.grant.receipt.siteId);
    }
    expect(verified).toEqual(REPAIR_SCENARIOS.map((site) => site.id));
    expect(h.writerFactory).not.toHaveBeenCalled();
    expect(vi.mocked(h.provider.request).mock.calls.some(([args]) => args.method === 'eth_sendTransaction')).toBe(false);
    expect(reloaded.getRecoveryTickets(caller)).toEqual([]); reloaded.dispose();
  });

  it('rejects forged archive artifacts, context, hashes and caller/contract/chain/version bindings without signing', async () => {
    const h = harness(); await h.adapter.submit(await h.prepare());
    const original = h.adapter.getApprovalEvidence(caller)[0]!;
    h.adapter.dispose();
    const reloaded = h.makeAdapter(); await reloaded.connect(h.provider);
    const changes = [
      { ...original, prepared: { ...original.prepared, artifact: createRepairExampleDraft('pier_hoist', 'initial-damage').artifact } },
      { ...original, contextFlags: Object.fromEntries(CONTEXT_FLAGS.map((flag) => [flag, true])) },
      { ...original, prepared: { ...original.prepared, contextFlags: { groundedInArtifact: true } } },
      { ...original, receipt: { decision: 'approved' } },
      { ...original, prepared: { ...original.prepared, caller: other } },
      { ...original, contractAddress: other }, { ...original, chainId: 4222 }, { ...original, version: 3 },
      { ...original, prepared: { ...original.prepared, fixtureVersion: 'other-v1' } },
      { ...original, txId: evmTxHash }, { ...original, prepared: { ...original.prepared, digest: evmTxHash } },
    ];
    vi.mocked(h.provider.request).mockClear();
    for (const forged of changes) expect(await reloaded.reverifyApproval(forged as ApprovalEvidence)).toMatchObject({ status: 'recovery-needed' });
    expect(await reloaded.reverifyApproval({ ...original, evmTxHash: txId })).toMatchObject({ status: 'timed-out', pending: true });
    // Even a valid revised construct with a newly computed digest must match the original call.
    const rationale = `${original.prepared.rationale} Revised.`;
    const digest = await digestRepairSubmission({ chainId: 4221,nativeChainId:1,contractAddress:addressFor(original.prepared.siteId) as `0x${string}`,caller,expeditionId:original.prepared.expeditionId,fixtureVersion: FIXTURE_VERSION,
      siteId: original.prepared.siteId, nonce: original.prepared.nonce }, original.prepared.artifact, rationale);
    expect(await reloaded.reverifyApproval({ ...original, prepared: { ...original.prepared, rationale, digest } })).toMatchObject({ status: 'recovery-needed' });
    expect(vi.mocked(h.provider.request).mock.calls.some(([args]) => args.method === 'eth_sendTransaction')).toBe(false);
    expect(h.writerFactory).toHaveBeenCalledTimes(1);
    expect(reloaded.getRecoveryTickets(caller)).toEqual([]); reloaded.dispose();
  });

  it('cannot hydrate archived approvals from provisional, failed or inconsistent latest-final evidence', async () => {
    const h = harness(); await h.adapter.submit(await h.prepare());
    const original = h.adapter.getApprovalEvidence(caller)[0]!;
    h.adapter.dispose();
    const reloaded = h.makeAdapter(); await reloaded.connect(h.provider);
    h.control.statuses = [5];
    expect(await reloaded.reverifyApproval(original)).toMatchObject({ status: 'timed-out', pending: true });
    h.control.statuses = [7]; h.control.executions = [2];
    expect(await reloaded.reverifyApproval(original)).toMatchObject({ status: 'failed', reason: 'execution' });
    h.control.executions = [1]; h.control.contextFlags.protectsHabitat = false;
    expect(await reloaded.reverifyApproval(original)).toMatchObject({ status: 'recovery-needed' });
    h.control.decision = 'rejected';
    expect(await reloaded.reverifyApproval(original)).toMatchObject({ status: 'recovery-needed' });
    h.control.contextFlags.protectsHabitat = true; h.control.decision = 'approved'; h.control.missingRecord = true;
    expect(await reloaded.reverifyApproval(original)).toMatchObject({ status: 'recovery-needed' });
    expect(reloaded.getRecoveryTickets(caller)).toEqual([]);
    expect(reloaded.getApprovalEvidence(caller)).toEqual([original]);
    expect(h.writerFactory).toHaveBeenCalledTimes(1); reloaded.dispose();
  });

  it('does not promote forged persisted cache constructions, transaction IDs or contextual awards on reload', async () => {
    const h = harness(); await h.adapter.submit(await h.prepare());
    const original = h.adapter.getApprovalEvidence(caller)[0]!;
    const archiveKey = [...h.disk.keys()].find((key) => key.endsWith(':approved-broadcast-v2'))!;
    h.adapter.dispose();
    const rename = (id: string) => `${id}_copy`;
    const artifact = createRepairArtifact({ ...original.prepared.artifact,
      parts: original.prepared.artifact.parts.map((part) => ({ ...part, id: rename(part.id) })),
      connections: original.prepared.artifact.connections.map((edge) => ({ ...edge,
        from: { ...edge.from, partId: rename(edge.from.partId) }, to: { ...edge.to, partId: rename(edge.to.partId) },
      })),
    }, getRepairScenario('pier_hoist'));
    expect(validateRepairLocally('pier_hoist', artifact).valid).toBe(true);
    const digest = await digestRepairSubmission({ chainId: 4221,nativeChainId:1,contractAddress:addressFor(original.prepared.siteId) as `0x${string}`,caller,expeditionId:original.prepared.expeditionId,fixtureVersion: FIXTURE_VERSION,
      siteId: original.prepared.siteId, nonce: original.prepared.nonce }, artifact, original.prepared.rationale);
    for (const forged of [
      { ...original, prepared: { ...original.prepared, artifact, digest } },
      { ...original, txId: evmTxHash },
      { ...original, contextFlags: Object.fromEntries(CONTEXT_FLAGS.map((flag) => [flag, true])), decision: 'approved' },
    ]) {
      h.disk.set(archiveKey, JSON.stringify([forged]));
      const reloaded = h.makeAdapter(); await reloaded.connect(h.provider);
      const loaded = reloaded.getApprovalEvidence(caller);
      expect(reloaded.getState()).toMatchObject({ status: 'ready' });
      if (Object.hasOwn(forged, 'contextFlags')) expect(loaded).toEqual([]);
      else {
        expect(loaded).toHaveLength(1);
        expect(await reloaded.reverifyApproval(loaded[0]!)).toMatchObject({ status: 'recovery-needed' });
      }
      expect(reloaded.getRecoveryTickets(caller)).toEqual([]); reloaded.dispose();
    }
    expect(h.writerFactory).toHaveBeenCalledTimes(1);
    expect(vi.mocked(h.provider.request).mock.calls.filter(([args]) => args.method === 'eth_sendTransaction')).toHaveLength(1);
  });

  it('keeps a pending original proof if approval archive storage fails, then recovers without a new broadcast', async () => {
    const h = harness();
    vi.mocked(h.storage.setItem).mockImplementation((key, value) => {
      if (key.endsWith(':approved-broadcast-v2')) throw new Error('Offline test archive quota.');
      h.disk.set(key, value);
    });
    expect(await h.adapter.submit(await h.prepare())).toMatchObject({ status: 'finalized-success' });
    expect(h.adapter.getRecoveryTickets(caller)).toHaveLength(1);
    expect(h.adapter.getApprovalEvidence(caller)).toHaveLength(1); // current-session evidence is not a durable save
    h.adapter.dispose();
    const reloaded = h.makeAdapter(); await reloaded.connect(h.provider);
    expect(reloaded.getApprovalEvidence(caller)).toEqual([]);
    const ticket = reloaded.getRecoveryTickets(caller)[0]!;
    vi.mocked(h.storage.setItem).mockImplementation((key, value) => { h.disk.set(key, value); });
    expect(await reloaded.resume(ticket)).toMatchObject({ status: 'finalized-success' });
    expect(reloaded.getRecoveryTickets(caller)).toEqual([]);
    expect(reloaded.getApprovalEvidence(caller)).toHaveLength(1);
    expect(h.writerFactory).toHaveBeenCalledTimes(1); reloaded.dispose();
  });

  it('bounds and isolates archive cache suggestions, and never turns an archived proof into a pending BUSY lock', async () => {
    const h = harness(); await h.adapter.submit(await h.prepare());
    const original = h.adapter.getApprovalEvidence(caller)[0]!;
    const archiveEntry = [...h.disk.entries()].find(([key]) => key.endsWith(':approved-broadcast-v2'))!;
    h.disk.set(archiveEntry[0], JSON.stringify(Array.from({ length: 9 }, () => original)));
    h.adapter.dispose();
    const reloaded = h.makeAdapter();
    expect(reloaded.getApprovalEvidence(caller)).toEqual([]); expect(reloaded.getApprovalEvidence(other)).toEqual([]);
    expect(await reloaded.reverifyApproval(original)).toMatchObject({ status: 'recovery-needed' }); // explicit original wallet required
    await reloaded.connect(h.provider);
    expect(await reloaded.reverifyApproval(original)).toMatchObject({ status: 'finalized-success' });
    expect(reloaded.getRecoveryTickets(caller)).toEqual([]);
    h.control.nextNonce = '1'; h.control.approvedSiteIds = ['pier_hoist'];
    h.control.evmTxHash = `0x${'c'.repeat(64)}`; h.control.txId = `0x${'d'.repeat(64)}`;
    const next = await reloaded.prepare(createRepairExampleDraft('village_pump', 'valid'));
    h.control.prepared=next;
    expect(await reloaded.submit(next)).toMatchObject({ status: 'finalized-success' });
    expect(h.writerFactory).toHaveBeenCalledTimes(2);
    expect(reloaded.getApprovalEvidence(caller).map((proof) => proof.prepared.siteId)).toEqual(['pier_hoist', 'village_pump']);
    reloaded.dispose();
  });

  for (const [status, expected] of [[6, 'timed-out'], [8, 'failed'], [12, 'timed-out'], [13, 'timed-out']] as const) {
    it(`keeps unresolved protocol status ${status} recoverable without an approval`, async () => {
      const h = harness(); h.control.statuses = [status];
      expect(await h.adapter.submit(await h.prepare())).toMatchObject(expected === 'timed-out'
        ? { status: 'timed-out', pending: true }
        : { status: 'failed', reason: 'canceled' });
      expect(h.adapter.getRecoveryTickets(caller)).toHaveLength(1);
      if (expected === 'timed-out') {
        h.control.nextNonce = '0';
        await expect(h.adapter.submit(await h.prepare())).rejects.toMatchObject({ code: 'BUSY' });
      }
      h.adapter.dispose();
    });
  }
  for (const [name, changes] of [
    ['wallet', { caller: other }], ['site', { siteId: 'village_pump' }], ['nonce', { nonce: '1' }],
    ['digest', { digest: txId }], ['version', { fixtureVersion: 'wrong-v1' }],
    ['rationale', { rationale: `${createRepairExampleDraft('pier_hoist', 'valid').rationale} Edited.` }],
    ['context flags', { contextFlags: { groundedInArtifact: true } }], ['technical flags', { technicalFlags: {} }],
  ] as const) {
    it(`does not grant from a mismatched ${name} receipt`, async () => {
      const h = harness(); h.control.recordChanges = { ...changes };
      expect(await h.adapter.submit(await h.prepare())).toMatchObject({ status: 'recovery-needed' });
      expect(h.observed.some((state) => state.status === 'finalized-success')).toBe(false);
      h.adapter.dispose();
    });
  }

  it('requires the original transaction payload, sender, recipient and GenLayer ID', async () => {
    for (const changes of [{ txData: '0x1234' }, { sender: other }, { recipient: other }, { txId: evmTxHash }]) {
      const h = harness(); h.control.txChanges = changes;
      expect(await h.adapter.submit(await h.prepare())).toMatchObject({ status: 'recovery-needed' });
      expect(h.observed.some((state) => state.status === 'finalized-success')).toBe(false);
      h.adapter.dispose();
    }
  });

  it('unknown, missing or conflicting execution evidence never grants', async () => {
    for (const execution of [0, undefined, 9]) {
      const h = harness(); h.control.executions = [execution];
      expect(await h.adapter.submit(await h.prepare())).toMatchObject({ status: 'recovery-needed' });
      expect(h.observed.some((state) => state.status === 'finalized' && state.execution === 'UNKNOWN')).toBe(true);
      h.adapter.dispose();
    }
    const h = harness(); h.control.txChanges.txExecutionResultName = 'FINISHED_WITH_ERROR';
    expect(await h.adapter.submit(await h.prepare())).toMatchObject({ status: 'recovery-needed' }); h.adapter.dispose();
  });

  it('missing latest-final record remains recoverable; a cached or provisional approval is insufficient', async () => {
    const h = harness(); h.control.missingRecord = true;
    expect(await h.adapter.submit(await h.prepare())).toMatchObject({ status: 'recovery-needed' });
    expect(h.observed.some((state) => state.status === 'finalized-success')).toBe(false);
    const ticket = h.adapter.getRecoveryTickets(caller)[0]!;
    h.control.missingRecord = false;
    expect(await h.adapter.resume(ticket)).toMatchObject({ status: 'finalized-success' });
    h.adapter.dispose();
  });

  it('does not submit damaged artifacts or a mutated/foreign prepared snapshot', async () => {
    const h = harness(); await h.adapter.connect(h.provider);
    const bad = await h.adapter.prepare(createRepairExampleDraft('pier_hoist', 'initial-damage'));
    expect(bad.technicallyValid).toBe(false);
    await expect(h.adapter.submit(bad)).rejects.toBeInstanceOf(GenLayerClientError);
    const good = await h.adapter.prepare(createRepairExampleDraft('pier_hoist', 'valid'));
    await expect(h.adapter.submit({ ...good })).rejects.toBeInstanceOf(GenLayerClientError);
    expect(h.writerFactory).not.toHaveBeenCalled(); h.adapter.dispose();
  });

  it('source/protocol/catalog mismatch disables connected use without opening a signer', async () => {
    for (const change of ['source', 'fixture']) {
      const h = harness(); if (change === 'source') h.control.code += '\n# incompatible source'; else h.control.fixtureVersion = 'wrong';
      expect(await h.adapter.connect(h.provider)).toMatchObject({ status: 'disabled', reason: 'contract-or-network-mismatch' });
      expect(h.writerFactory).not.toHaveBeenCalled(); h.adapter.dispose();
    }
  });

  it('wallet refusal, RPC errors and stale nonces cannot be called chain decisions', async () => {
    const h = harness(); const prepared = await h.prepare(); h.control.walletError = { code: 4001 };
    expect(await h.adapter.submit(prepared)).toMatchObject({ status: 'wallet-rejected' });
    expect(h.adapter.getRecoveryTickets(caller)).toEqual([]);
    h.adapter.dispose();
    const stale = harness(); const old = await stale.prepare(); stale.control.nextNonce = '1';
    expect(await stale.adapter.submit(old)).toMatchObject({ status: 'network-error' }); expect(stale.writerFactory).not.toHaveBeenCalled(); stale.adapter.dispose();
    const rpc = harness(); const current = await rpc.prepare(); vi.mocked(rpc.read.getTransaction).mockRejectedValue(new Error('[TRANSIENT] arbitrary untrusted text'));
    expect(await rpc.adapter.submit(current)).toMatchObject({ status: 'network-error' }); rpc.adapter.dispose();
  });

  it('disconnect and account/network events invalidate writes and prevent late grants', async () => {
    for (const event of ['accountsChanged', 'chainChanged', 'disconnect']) {
      const h = harness(); const prepared = await h.prepare(); h.event(event);
      await expect(h.adapter.submit(prepared)).rejects.toBeInstanceOf(GenLayerClientError);
      expect(h.adapter.getState()).toEqual({ status: 'disconnected' }); h.adapter.dispose();
    }
    const h = harness(); const prepared = await h.prepare(); h.control.afterBroadcast = () => { h.control.wallet = other; h.event('accountsChanged'); };
    expect(await h.adapter.submit(prepared)).toEqual({ status: 'disconnected' });
    expect(h.adapter.getRecoveryTickets(caller)).toHaveLength(1);
    expect(h.adapter.getRecoveryTickets(other)).toHaveLength(0);
    expect(h.observed.some((state) => state.status === 'finalized-success')).toBe(false);
    h.adapter.dispose();
  });

  it('wrong caller, altered digest and altered transaction ID tickets cannot be silently adopted', async () => {
    const h = harness(); h.control.statuses = [5];
    await h.adapter.submit(await h.prepare()); const ticket = h.adapter.getRecoveryTickets(caller)[0]!;
    for (const changed of [
      { ...ticket, prepared: { ...ticket.prepared, caller: other } },
      { ...ticket, prepared: { ...ticket.prepared, digest: evmTxHash } }, { ...ticket, txId: evmTxHash },
    ]) expect(await h.adapter.resume(changed)).toMatchObject({ status: 'recovery-needed' });
    expect(h.observed.some((state) => state.status === 'finalized-success')).toBe(false); h.adapter.dispose();
  });

  it('EVM reverted submissions are explicit failures and spoofed event origins grant nothing', async () => {
    const h = harness(); h.control.evmReverted = true;
    expect(await h.adapter.submit(await h.prepare())).toMatchObject({ status: 'failed', reason: 'execution' }); h.adapter.dispose();
    const spoof = harness(); spoof.control.receiptEventAddress = other;
    expect(await spoof.adapter.submit(await spoof.prepare())).toMatchObject({ status: 'timed-out', pending: true });
    expect(spoof.read.getTransaction).not.toHaveBeenCalled(); spoof.adapter.dispose();
  });

  it('bounded RPC timeouts and explicit poll cancellation preserve recovery without rebroadcast', async () => {
    const h = harness({ readTimeoutMs: 1 }); const prepared = await h.prepare();
    vi.mocked(h.read.getTransaction).mockImplementation(() => new Promise(() => {}));
    expect(await h.adapter.submit(prepared)).toMatchObject({ status: 'network-error' });
    const ticket = h.adapter.getRecoveryTickets(caller)[0]!;
    const controller = new AbortController(); controller.abort();
    expect(await h.adapter.resume(ticket, controller.signal)).toMatchObject({ status: 'recovery-needed' });
    expect(h.writerFactory).toHaveBeenCalledTimes(1); h.adapter.dispose();
  });

  it('exercises the installed 1.1.8 SDK external-provider write pipeline using only mocked JSON-RPC', async () => {
    const h = harness(), methods: string[] = [];
    const topics = encodeEventTopics({ abi: consensus.abi, eventName: 'CreatedTransaction', args: { txId } });
    const rpcReceipt = { transactionHash: evmTxHash, transactionIndex: '0x0', blockHash: txId, blockNumber: '0x1',
      from: caller, to: consensus.address, cumulativeGasUsed: '0x1', gasUsed: '0x1', effectiveGasPrice: '0x1',
      contractAddress: null, status: '0x1', type: '0x0', logsBloom: `0x${'0'.repeat(512)}`,
      logs: [{ address: consensus.address, topics, data: encodeAbiParameters([{ type: 'uint256' }], [1n]),
        blockHash: txId, blockNumber: '0x1', transactionHash: evmTxHash, transactionIndex: '0x0', logIndex: '0x0', removed: false }],
    };
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      expect(String(url)).toBe('https://rpc-bradbury.genlayer.com');
      const request = JSON.parse(String(init.body)) as { method: string; id: number };
      methods.push(request.method);
      const response: Record<string, unknown> = { eth_chainId: '0x107d', eth_getTransactionCount: '0x0', eth_estimateGas: '0x61a80',
        eth_gasPrice: '0x1', eth_blockNumber: '0x1', eth_getTransactionReceipt: rpcReceipt };
      if (!Object.hasOwn(response, request.method)) throw new Error('Unsupported offline SDK RPC method.');
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: response[request.method] }), { headers: { 'Content-Type': 'application/json' } });
    }));
    let writing: Promise<Hash> | undefined;
    const actual = h.makeAdapter({ ...h.options, writerFactory: (account, guarded) => {
      const sdk = createClient({ chain: testnetBradbury, account, provider: guarded } as NonNullable<Parameters<typeof createClient>[0]>);
      return { writeContract: (args) => { writing = sdk.writeContract(args); return writing; } };
    } });
    try {
      await actual.connect(h.provider);
      const prepared = await actual.prepare(createRepairExampleDraft('pier_hoist', 'valid'));
      h.control.prepared=prepared;
      expect(await actual.submit(prepared)).toMatchObject({ status: 'finalized-success' });
      await expect(writing).resolves.toBe(txId);
      expect(methods).toContain('eth_getTransactionReceipt');
      const sends = vi.mocked(h.provider.request).mock.calls.filter(([args]) => args.method === 'eth_sendTransaction');
      expect(sends).toHaveLength(1);
      // Bradbury's deployed stable Consensus accepts the six-input ABI, not
      // the separate v0.6 fee-distribution RC. Exercise the installed SDK's
      // exact outgoing envelope rather than only the scripted writer above.
      const tx = sends[0]![0].params![0] as { data: Hash; value: string; to: string; chainId: string };
      expect(tx.to.toLowerCase()).toBe(consensus.address.toLowerCase());
      expect(tx.value).toBe('0x0');
      expect(tx.chainId).toBe('0x107d');
      expect(tx.data.slice(0, 10)).toBe('0xe71d5196');
      const decoded = decodeFunctionData({ abi: consensus.abi, data: tx.data });
      expect(decoded.functionName).toBe('addTransaction');
      expect(decoded.args).toHaveLength(6);
      expect(decoded.args?.slice(0, 5)).toEqual([caller, contractAddress, 5n, 3n, submissionData(prepared)]);
      const validUntil = decoded.args?.[5] as bigint;
      const now = BigInt(Math.floor(Date.now() / 1000));
      expect(validUntil).toBeGreaterThan(now);
      expect(validUntil).toBeLessThanOrEqual(now + 3600n);
    } finally { actual.dispose(); h.adapter.dispose(); vi.unstubAllGlobals(); }
  });
});
