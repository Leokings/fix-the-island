import { abi, createClient } from 'genlayer-js';
import { studionet, testnetBradbury } from 'genlayer-js/chains';
import { TransactionHashVariant } from 'genlayer-js/types';
import type { CalldataEncodable } from 'genlayer-js/types';
import { decodeFunctionData, getAddress, TransactionReceiptNotFoundError } from 'viem';
import { withReadRetry } from './read-retry';
import { councilVotes } from './council/validator-votes';
import { REPAIR_SCENARIOS, FIXTURE_VERSION, getRepairScenario } from './catalog';
import { SITE_CONTRACT_META } from './site-contract-meta';
import { PER_SITE_NATIVE_CHAIN_ID } from './native-context';
import { canonicalizeRepairArtifact, digestRepairSubmission } from './canonical';
import { validateRepairLocally } from './advisory';
import { createRepairArtifact, normalizeAddress, normalizeNonce, normalizeRationale } from './schema';
import { GenLayerClientError, GenLayerUnavailableError, resolveGenLayerConfig, siteContractAddress } from './config';
import { calldataAddress, hash, invalid, object, receiptEvidence, recoveryEvidence, transactionIdFromReceipt,
  sha256, submissionArgs, submissionData, transactionEvidence, archiveShape, approvedBroadcastEvidence } from './evidence';
import type { Address, ApprovalEvidence, GenLayerAdapter, GenLayerConfig, Hash, InjectedProvider, IslandSiteId, PreparedRepair, RecoveryTicket, RepairDraft, RepairState } from './types';
import {studioRecoveryTickets} from './studio-recovery';

export interface RepairReadClient {
  request(args: { method: 'eth_chainId' } | {method:'sim_getTransactionsForAddress';params:[Address]}): Promise<unknown>;
  getContractCode(address: Address): Promise<string>;
  readContract(args: { address: Address; functionName: string; args: CalldataEncodable[];
    leaderOnly: false; jsonSafeReturn: true; transactionHashVariant: TransactionHashVariant.LATEST_FINAL }): Promise<unknown>;
  getTransaction(args: { hash: Hash }): Promise<unknown>;
  getTransactionReceipt(args: { hash: Hash }): Promise<unknown>;
}
export interface RepairWriteClient {
  writeContract(args: { address: Address; functionName: 'submit_repair'|'retry_dependency_notifications'; args: CalldataEncodable[]; value: 0n; leaderOnly: false }): Promise<Hash>;
}
export interface GenLayerAdapterOptions {
  readonly publicClient?: RepairReadClient;
  readonly writerFactory?: (caller: Address, provider: InjectedProvider) => RepairWriteClient;
  readonly storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  readonly maxPolls?: number;
  readonly maxPollMs?: number;
  readonly pollIntervalMs?: number;
  readonly readTimeoutMs?: number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
}

// Exact stable SDK addTransaction variants; no arbitrary wallet transaction is exposed.
const inputFields = [
  { name: '_sender', type: 'address' }, { name: '_recipient', type: 'address' },
  { name: '_numOfInitialValidators', type: 'uint256' }, { name: '_maxRotations', type: 'uint256' },
  { name: '_txData', type: 'bytes' },
] as const;
const addV5 = [{ type: 'function', name: 'addTransaction', stateMutability: 'nonpayable', inputs: inputFields, outputs: [] }] as const;
const addV6 = [{ ...addV5[0], inputs: [...inputFields, { name: '_validUntil', type: 'uint256' }] }] as const;
// The installed 1.1.8 preset is runtime-complete; its optional-field declaration
// predates exactOptionalPropertyTypes. Keep every preset ABI/address unchanged.
const presetFor = (network: 'studionet' | 'testnetBradbury') => network === 'studionet' ? studionet : testnetBradbury;
const boundedInteger = (value: number | undefined, fallback: number, min: number, max: number): number =>
  value === undefined ? fallback : Number.isInteger(value) && value >= min && value <= max ? value : (() => { throw new Error('Invalid bounded polling configuration.'); })();
const code = (error: unknown): number | undefined => {
  for (let current = error, depth = 0; depth < 4; depth++) {
    if (typeof current !== 'object' || current === null) return undefined;
    const value = current as Record<string, unknown>;
    if (typeof value.code === 'number') return value.code;
    current = value.cause;
  }
  return undefined;
};
const safeErrorDetail = (error: unknown): string => {
  for (let current = error, depth = 0; depth < 3; depth++) {
    if (typeof current !== 'object' || current === null) break;
    const value = current as Record<string, unknown>;
    const message = typeof value.shortMessage === 'string' ? value.shortMessage : value.message;
    if (typeof message === 'string' && message.trim()) {
      return message.replace(/0x[a-f\d]{40}/gi, '[wallet address]').replace(/\s+/g, ' ').trim().slice(0, 180);
    }
    current = value.cause;
  }
  return '';
};
const chainId = (value: unknown): number => {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{1,8}$/.test(value)) invalid();
  return Number.parseInt(value.slice(2), 16);
};

/** Read-only on boot. Only explicit connect/submit can request wallet interaction. */
export function createGenLayerAdapter(configuration: GenLayerConfig, options: GenLayerAdapterOptions = {}): GenLayerAdapter {
  if (configuration.enabled) {
    const preset = presetFor(configuration.network);
    if (configuration.chainId !== preset.id || configuration.rpcUrl !== preset.rpcUrls.default.http[0]) invalid();
  }
  if (configuration.enabled) {
    const checked = resolveGenLayerConfig({ VITE_GENLAYER_SITE_ADDRESSES: JSON.stringify(configuration.siteAddresses), VITE_GENLAYER_NETWORK: configuration.network });
    if (!checked.enabled || checked.contractAddress !== normalizeAddress(configuration.contractAddress)) invalid();
  }
  const config: GenLayerConfig = Object.freeze(configuration.enabled ? {
    enabled: true, contractAddress: normalizeAddress(configuration.contractAddress), chainId: configuration.chainId,
    siteAddresses: Object.freeze(Object.fromEntries(Object.entries(configuration.siteAddresses).map(([id,address]) => [id,normalizeAddress(address)])) as Record<IslandSiteId, Address>),
    network: configuration.network, rpcUrl: configuration.rpcUrl,
  } : { enabled: false, reason: configuration.reason === 'invalid-address' ? 'invalid-address' : 'unconfigured' });
  const frozenConfig = config;
  const nativeChainId = config.enabled
    ? config.network === 'studionet' ? config.chainId : PER_SITE_NATIVE_CHAIN_ID
    : 4221;
  let state: RepairState = Object.freeze(config.enabled ? { status: 'disconnected' } : { status: 'disabled', reason: config.reason });
  const listeners = new Set<(snapshot: RepairState) => void>();
  let provider: InjectedProvider | undefined, wallet: Address | undefined, disposed = false, generation = 0;
  let activeExpeditionId: Hash | undefined;
  let proof: Promise<void> | undefined, registered = new WeakSet<PreparedRepair>(), writeInFlight = false;
  let pollController: AbortController | undefined;
  let publicClient: RepairReadClient | undefined = options.publicClient;
  const tickets = new Map<Hash, RecoveryTicket>();
  const terminalReads = new Set<Hash>();
  const approvedArchive = new Map<string, ApprovalEvidence>();
  // A review can take minutes (validator rotations). Poll every few seconds for two
  // minutes, then every 15 s, for up to 15 minutes before asking the player to recover.
  const maxPolls = boundedInteger(options.maxPolls, 120, 1, 240);
  const maxPollMs = boundedInteger(options.maxPollMs, 900_000, 1, 900_000);
  const interval = boundedInteger(options.pollIntervalMs, 3000, 0, 15_000);
  const readTimeout = boundedInteger(options.readTimeoutMs, 10_000, 1, 20_000);
  const sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let storage: GenLayerAdapterOptions['storage'] = options.storage;
  if (storage === undefined) { try { storage = typeof window === 'undefined' ? null : window.localStorage; } catch { storage = null; } }

  function emit(next: RepairState): RepairState {
    if (disposed) return state;
    state = Object.freeze(next);
    for (const listener of listeners) { try { listener(state); } catch { /* Subscriber failures cannot change authority. */ } }
    return state;
  }
  function enabled(): Extract<GenLayerConfig, { enabled: true }> {
    if (disposed) throw new GenLayerUnavailableError('disposed');
    if (!config.enabled) throw new GenLayerUnavailableError(config.reason);
    return config;
  }
  const addressFor = (siteId: string) => siteContractAddress(enabled(), siteId);
  // Studio's gen_getContractCode lookup is case-sensitive even though EVM
  // addresses are not. Keep the canonical lowercase address for comparisons,
  // but send EIP-55 form at RPC contract-address boundaries.
  const rpcAddressFor = (siteId: string): Address => getAddress(addressFor(siteId));
  function readClient(): RepairReadClient {
    enabled();
    // No account, injected provider, private key or global endpoint mutation.
    const chain = presetFor(enabled().network) as unknown as NonNullable<NonNullable<Parameters<typeof createClient>[0]>['chain']>;
    return publicClient ??= createClient({ chain }) as unknown as RepairReadClient;
  }
  async function bounded<T>(job: Promise<T>, signal?: AbortSignal, timeout = readTimeout): Promise<T> {
    if (signal?.aborted) throw new GenLayerClientError('ABORTED', 'Read cancelled; keep the recovery ticket.');
    let timer: ReturnType<typeof setTimeout> | undefined, abort: (() => void) | undefined;
    try {
      return await Promise.race([job, new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new GenLayerClientError('READ_TIMEOUT', 'Public read timed out.')), timeout);
        abort = () => reject(new GenLayerClientError('ABORTED', 'Read cancelled; keep the recovery ticket.'));
        signal?.addEventListener('abort', abort, { once: true });
      })]);
    } finally { if (timer) clearTimeout(timer); if (abort) signal?.removeEventListener('abort', abort); }
  }
  /** Public reads retry transient network failures (see read-retry.ts). Wallet transactions never do. */
  function retried<T>(make: () => Promise<T>, signal?: AbortSignal, timeout = readTimeout): Promise<T> {
    return withReadRetry(() => bounded(make(), signal, timeout), signal ? { sleep, signal } : { sleep });
  }
  async function view(name: string, args: CalldataEncodable[], signal?: AbortSignal, siteId = 'pier_hoist'): Promise<unknown> {
    return retried(() => readClient().readContract({ address: rpcAddressFor(siteId), functionName: name, args,
      leaderOnly: false, jsonSafeReturn: true, transactionHashVariant: TransactionHashVariant.LATEST_FINAL }), signal);
  }
  async function verifyProtocol(): Promise<void> {
    if (!proof) proof = (async () => {
      const read = readClient();
      if (chainId(await retried(() => read.request({ method: 'eth_chainId' }))) !== enabled().chainId) invalid();
      // Keep the RPC load bounded: Studio can serve individual reads quickly but
      // overloads under a full eight-site burst.
      const batchSize = 2;
      for (let offset = 0; offset < REPAIR_SCENARIOS.length; offset += batchSize) {
        const batch = REPAIR_SCENARIOS.slice(offset, offset + batchSize);
        await Promise.all(batch.map(async site => {
          const source = await retried(() => read.getContractCode(rpcAddressFor(site.id)));
          if (typeof source !== 'string' || source.length > 150_000 || await sha256(source.replace(/\r\n/g, '\n')) !== SITE_CONTRACT_META[site.id].codeHash) invalid();
          const protocol = object(await view('get_protocol', [], undefined, site.id));
          if (protocol.protocolVersion !== 'repair-v2' || protocol.fixtureVersion !== FIXTURE_VERSION || protocol.chainId !== nativeChainId || protocol.architecture !== 'async-notify-v1' || JSON.stringify(protocol.sites) !== JSON.stringify([site.id])) invalid();
          const dependencies = object(protocol.dependencies);
          if (Object.keys(dependencies).length !== site.requires.length || site.requires.some(parent => dependencies[parent] !== addressFor(parent))) invalid();
          const childSites=REPAIR_SCENARIOS.filter(candidate=>candidate.requires.includes(site.id));
          const dependents=object(protocol.dependents);
          if(protocol.dependentsConfigured!==true||Object.keys(dependents).length!==childSites.length||childSites.some(child=>dependents[child.id]!==addressFor(child.id)))invalid();
        }));
      }
    })().catch((error: unknown) => { proof = undefined; throw error; });
    return proof;
  }
  function expedition(): Hash { if (!activeExpeditionId) invalid(); return activeExpeditionId; }
  function setExpedition(expeditionId: Hash): void { if (!/^0x[0-9a-f]{64}$/.test(expeditionId)) invalid(); activeExpeditionId = expeditionId; }
  function key(caller: Address): string { return `fix-island:connected:${enabled().chainId}:${enabled().contractAddress}:${caller}:${expedition()}:${FIXTURE_VERSION}:pending-v2`; }
  function archiveKey(caller: Address): string { return `fix-island:connected:${enabled().chainId}:${enabled().contractAddress}:${caller}:${expedition()}:${FIXTURE_VERSION}:approved-broadcast-v2`; }
  function getApprovalEvidence(callerInput: Address): readonly ApprovalEvidence[] {
    if (!config.enabled || disposed) return Object.freeze([]);
    const caller = normalizeAddress(callerInput);
    try {
      const raw = storage?.getItem(archiveKey(caller));
      if (raw && raw.length <= 150_000) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length <= 8) for (const item of parsed) {
          const value = archiveShape(item), draft = object(value.prepared);
          if (value.version !== 2 || value.chainId !== enabled().chainId || value.contractAddress !== addressFor(draft.siteId as string) || draft.caller !== caller || draft.expeditionId !== expedition() || draft.fixtureVersion !== FIXTURE_VERSION) continue;
          const site = getRepairScenario(draft.siteId as string), evmTxHash = hash(value.evmTxHash), txId = hash(value.txId);
          const artifact = createRepairArtifact(draft.artifact as PreparedRepair['artifact'], site);
          const snapshot = Object.freeze({ ...value, evmTxHash, txId, prepared: Object.freeze({ ...draft, artifact,
            technicalFlags: Object.freeze({ ...object(draft.technicalFlags) }) }) }) as unknown as ApprovalEvidence;
          const entryKey = `${caller}:${draft.expeditionId as string}:${site.id}`;
          if (!approvedArchive.has(entryKey)) approvedArchive.set(entryKey, snapshot);
        }
      }
    } catch { /* Cache corruption never creates a grant. Reverification is mandatory. */ }
    // The fixed catalog order is topological and bounded to eight sites.
    return Object.freeze(REPAIR_SCENARIOS.flatMap((site) => {
      const evidence = approvedArchive.get(`${caller}:${expedition()}:${site.id}`);
      return evidence ? [evidence] : [];
    }));
  }
  function archive(ticket: RecoveryTicket): boolean {
    if (!ticket.txId) invalid();
    const caller = ticket.prepared.caller;
    getApprovalEvidence(caller);
    approvedArchive.set(`${caller}:${ticket.prepared.expeditionId}:${ticket.prepared.siteId}`, Object.freeze({ ...ticket, kind: 'approved-broadcast-v1', txId: ticket.txId }));
    const entries = REPAIR_SCENARIOS.flatMap((site) => {
      const evidence = approvedArchive.get(`${caller}:${ticket.prepared.expeditionId}:${site.id}`);
      return evidence ? [evidence] : [];
    });
    try { storage?.setItem(archiveKey(caller), JSON.stringify(entries)); return !!storage; }
    catch { return false; }
  }
  function getRecoveryTickets(callerInput: Address): readonly RecoveryTicket[] {
    if (!config.enabled || disposed) return Object.freeze([]);
    const caller = normalizeAddress(callerInput);
    try {
      const raw = storage?.getItem(key(caller));
      if (raw && raw.length <= 500_000) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length <= 32) for (const item of parsed) {
          const value = object(item), draft = object(value.prepared);
          // Tickets are untrusted suggestions until resume revalidates digest and chain evidence.
          if (value.version === 2 && value.chainId === enabled().chainId && value.contractAddress === addressFor(draft.siteId as string) && draft.caller === caller && draft.expeditionId === expedition() && draft.fixtureVersion === FIXTURE_VERSION) {
            const evmTxHash = hash(value.evmTxHash);
            const artifact = createRepairArtifact(draft.artifact as PreparedRepair['artifact'], getRepairScenario(draft.siteId as string));
            const snapshot = Object.freeze({ ...value, prepared: Object.freeze({ ...draft, artifact, technicalFlags: Object.freeze({ ...object(draft.technicalFlags) }) }) }) as unknown as RecoveryTicket;
            if (snapshot.prepared.expeditionId === expedition() && !terminalReads.has(evmTxHash)&&!tickets.has(evmTxHash)) tickets.set(evmTxHash, snapshot);
          }
        }
      }
    } catch { /* Corrupt/unavailable saves never become approvals. */ }
    return Object.freeze([...tickets.values()].filter((ticket) => ticket.prepared.caller === caller && ticket.prepared.expeditionId === expedition()));
  }
  function save(ticket: RecoveryTicket): boolean {
    getRecoveryTickets(ticket.prepared.caller);
    tickets.set(ticket.evmTxHash, ticket);
    try { storage?.setItem(key(ticket.prepared.caller), JSON.stringify([...tickets.values()].filter((entry) => entry.prepared.caller === ticket.prepared.caller && entry.prepared.expeditionId === ticket.prepared.expeditionId).slice(-32))); return !!storage; }
    catch { return false; }
  }
  function finish(ticket: RecoveryTicket): void {
    tickets.delete(ticket.evmTxHash);
    terminalReads.add(ticket.evmTxHash);
    try { storage?.setItem(key(ticket.prepared.caller), JSON.stringify([...tickets.values()].filter((entry) => entry.prepared.caller === ticket.prepared.caller && entry.prepared.expeditionId === ticket.prepared.expeditionId))); } catch { /* A stale saved ticket still requires explicit verified recovery. */ }
  }
  async function discoverRecovery(callerInput:Address,signal?:AbortSignal):Promise<readonly RecoveryTicket[]> {
    const caller=normalizeAddress(callerInput);
    if(!config.enabled||config.network!=='studionet')return [];
    await bounded(verifyProtocol(),signal,60000);
    const rows=await retried(()=>readClient().request({method:'sim_getTransactionsForAddress',params:[caller]}),signal);
    const discovered=await studioRecoveryTickets(rows,caller,addressFor,expedition());
    const archived=new Set(getApprovalEvidence(caller).map(item=>item.evmTxHash));
    for(const ticket of discovered)if(!archived.has(ticket.evmTxHash)&&!terminalReads.has(ticket.evmTxHash))save(ticket);
    return discovered;
  }
  async function getSiteProgress(caller: Address, siteId: string, expeditionId = expedition()) {
    const value = object(await view('get_progress', [calldataAddress(caller), expeditionId], undefined, siteId));
    const nextNonce = normalizeNonce(value.nextNonce as string);
    if (value.expeditionId !== expeditionId || typeof value.dependencyReady !== 'boolean' || !Array.isArray(value.requiredParentSiteIds) || !Array.isArray(value.confirmedParentSiteIds)) invalid();
    const requiredIds=value.requiredParentSiteIds as unknown[],confirmedIds=value.confirmedParentSiteIds as unknown[];
    if (!Array.isArray(value.approvedSiteIds) || value.approvedSiteIds.length > 1 ||
      new Set(value.approvedSiteIds).size!==value.approvedSiteIds.length ||
      value.approvedSiteIds.some(id => id !== siteId)) invalid();
    const fixture=getRepairScenario(siteId);
    if(requiredIds.some(parent=>typeof parent!=='string')||confirmedIds.some(parent=>typeof parent!=='string')||new Set(confirmedIds).size!==confirmedIds.length||requiredIds.length!==fixture.requires.length||fixture.requires.some(parent=>!requiredIds.includes(parent))||confirmedIds.some(parent=>!fixture.requires.includes(parent as string))||value.dependencyReady!==(confirmedIds.length===fixture.requires.length))invalid();
    return Object.freeze({ id: siteId, nextNonce, approved: value.approvedSiteIds.includes(siteId), dependencyReady: value.dependencyReady, requiredParentSiteIds: Object.freeze([...requiredIds] as string[]), confirmedParentSiteIds: Object.freeze([...confirmedIds] as string[]) });
  }
  async function getProgress(callerInput: Address, siteId = 'pier_hoist') {
    const caller = normalizeAddress(callerInput);
    await verifyProtocol();
    const expeditionId = expedition();
    // Eight independent site contracts own progress. Limit concurrency because
    // Studio may return malformed RLP under a full fan-out.
    const progress: { id: string; nonce: string; approved: boolean; dependencyReady:boolean; requiredParentSiteIds:readonly string[]; confirmedParentSiteIds:readonly string[] }[] = [];
    const batchSize = 2;
    for (let offset = 0; offset < REPAIR_SCENARIOS.length; offset += batchSize) {
      const batch = REPAIR_SCENARIOS.slice(offset, offset + batchSize);
      progress.push(...await Promise.all(batch.map(async site => {
        const value = await getSiteProgress(caller, site.id, expeditionId);
        return { id: site.id, nonce: value.nextNonce, approved: value.approved, dependencyReady:value.dependencyReady, requiredParentSiteIds:value.requiredParentSiteIds, confirmedParentSiteIds:value.confirmedParentSiteIds };
      })));
    }
    const current = progress.find(site => site.id === siteId);
    if (!current) invalid();
    return Object.freeze({ nextNonce: current.nonce, approvedSiteIds: Object.freeze(progress.filter(site => site.approved).map(site => site.id)), dependencyReady:current.dependencyReady, requiredParentSiteIds:current.requiredParentSiteIds, confirmedParentSiteIds:current.confirmedParentSiteIds });
  }
  async function getProgressForSite(callerInput: Address, siteId: string) {
    const caller = normalizeAddress(callerInput);
    await verifyProtocol();
    return getSiteProgress(caller, siteId, expedition());
  }
  const accountsChanged = () => disconnect();
  const chainChanged = () => disconnect();
  const providerDisconnected = () => disconnect();
  function detach(): void {
    provider?.removeListener?.('accountsChanged', accountsChanged);
    provider?.removeListener?.('chainChanged', chainChanged);
    provider?.removeListener?.('disconnect', providerDisconnected);
  }
  function disconnect(): void {
    detach(); provider = undefined; wallet = undefined; generation++; registered = new WeakSet(); proof = undefined;
    pollController?.abort();
    if (config.enabled) emit({ status: 'disconnected' });
  }
  async function connect(injected: InjectedProvider): Promise<RepairState> {
    if (!config.enabled || disposed) return state;
    disconnect();
    const epoch = generation;
    try {
      const accounts = await injected.request({ method: 'eth_requestAccounts' });
      if (!Array.isArray(accounts) || accounts.length === 0) return emit({ status: 'disconnected' });
      const caller = normalizeAddress(accounts[0] as string);
      let actual = chainId(await injected.request({ method: 'eth_chainId' }));
      const preset = presetFor(enabled().network), targetChain = enabled().chainId;
      const targetHex = `0x${targetChain.toString(16)}`;
      if (actual !== targetChain) {
        try { await injected.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: targetHex }] }); }
        catch (error) {
          const unknownChain = code(error) === 4902 || /(?:unrecognized|unknown|not added).{0,40}chain|chain.{0,40}(?:unrecognized|unknown|not added)/i.test(safeErrorDetail(error));
          if (!unknownChain) throw error;
          await injected.request({ method: 'wallet_addEthereumChain', params: [{ chainId: targetHex, chainName: preset.name,
            nativeCurrency: preset.nativeCurrency, rpcUrls: [...preset.rpcUrls.default.http],
            blockExplorerUrls: [preset.blockExplorers!.default.url] }] });
          await injected.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: targetHex }] });
        }
        actual = chainId(await injected.request({ method: 'eth_chainId' }));
      }
      if (actual !== targetChain) return emit({ status: 'wrong-network', expectedChainId: targetChain, actualChainId: actual });
      await verifyProtocol();
      const current = await injected.request({ method: 'eth_accounts' });
      if (!Array.isArray(current) || normalizeAddress(current[0] as string) !== caller || chainId(await injected.request({ method: 'eth_chainId' })) !== targetChain) invalid();
      if (epoch !== generation || disposed) return state;
      provider = injected; wallet = caller;
      provider.on?.('accountsChanged', accountsChanged); provider.on?.('chainChanged', chainChanged); provider.on?.('disconnect', providerDisconnected);
      return emit({ status: 'ready', wallet });
    } catch (error) {
      if (epoch !== generation || disposed) return state;
      if (code(error) === 4001) return emit({ status: 'wallet-rejected', message: 'Wallet connection or network change was declined. Nothing was submitted.' });
      if (error instanceof GenLayerClientError && error.code === 'INVALID_EVIDENCE') return emit({ status: 'disabled', reason: 'contract-or-network-mismatch' });
      const detail = safeErrorDetail(error);
      return emit({ status: 'network-error', message: `Connection could not be verified${detail ? `: ${detail}` : '.'} Retry explicitly; nothing was submitted.` });
    }
  }
  async function checkWallet(epoch: number, caller: Address, injected = provider): Promise<void> {
    if (disposed || epoch !== generation || !injected || wallet !== caller) throw new GenLayerClientError('DISCONNECTED', 'Reconnect the original submitting wallet.');
    const accounts = await bounded(injected.request({ method: 'eth_accounts' }));
    if (!Array.isArray(accounts) || accounts.length === 0 || normalizeAddress(accounts[0] as string) !== caller) { disconnect(); throw new GenLayerClientError('DISCONNECTED', 'Wallet changed.'); }
    const actual = chainId(await bounded(injected.request({ method: 'eth_chainId' })));
    if (actual !== enabled().chainId) { disconnect(); emit({ status: 'wrong-network', expectedChainId: enabled().chainId, actualChainId: actual }); throw new GenLayerClientError('WRONG_NETWORK', 'Switch to the configured GenLayer network.'); }
    if (epoch !== generation || disposed) throw new GenLayerClientError('DISCONNECTED', 'Wallet session changed.');
  }
  async function prepare(draft: RepairDraft): Promise<PreparedRepair> {
    const address = addressFor(draft.siteId);
    if (!wallet || !provider) throw new GenLayerClientError('DISCONNECTED', 'Connect an injected wallet explicitly before preparing.');
    const epoch = generation, caller = wallet, site = getRepairScenario(draft.siteId);
    const artifact = createRepairArtifact(draft.artifact, site), rationale = normalizeRationale(draft.rationale);
    await checkWallet(epoch, caller);
    // Dependency readiness comes from child-local finalized notifications,
    // never from a synchronous cross-contract storage read.
    const expeditionId = expedition();
    const progress = await getSiteProgress(caller, site.id, expeditionId);
    const local = validateRepairLocally(site.id, artifact);
    const technicalFlags = Object.freeze({ ...local.flags,
      dependencies: progress.dependencyReady,
      nonce: true,
      newSite: !progress.approved,
    });
    const prepared: PreparedRepair = Object.freeze({ siteId: site.id, artifact, rationale, caller, expeditionId,
      nonce: progress.nextNonce,
      digest: await digestRepairSubmission({ chainId: enabled().chainId, nativeChainId,
        contractAddress: address, caller, expeditionId, siteId: site.id, nonce: progress.nextNonce, fixtureVersion: FIXTURE_VERSION }, artifact, rationale),
      fixtureVersion: FIXTURE_VERSION, technicalFlags,
      technicallyValid: Object.values(technicalFlags).every(Boolean),
    });
    if (prepared.caller !== caller || prepared.siteId !== site.id || prepared.nonce !== progress.nextNonce || canonicalizeRepairArtifact(prepared.artifact) !== canonicalizeRepairArtifact(artifact) || prepared.rationale !== rationale ||
        Object.entries(local.flags).some(([name, valid]) => prepared.technicalFlags[name] !== valid) ||
        prepared.technicalFlags.dependencies !== progress.dependencyReady || prepared.technicalFlags.newSite !== !progress.approved || !prepared.technicalFlags.nonce) invalid();
    await checkWallet(epoch, caller);
    registered.add(prepared); emit({ status: 'queued', prepared });
    return prepared;
  }
  async function retryDependencyNotification(parentSiteId:string,childSiteId:string):Promise<Hash> {
    if(!config.enabled||disposed||!wallet||!provider)throw new GenLayerClientError('DISCONNECTED','Connect the original wallet before retrying a prerequisite notification.');
    const child=getRepairScenario(childSiteId),parent=getRepairScenario(parentSiteId);
    if(!child.requires.includes(parent.id))invalid();
    const epoch=generation,caller=wallet,runId=expedition();
    await checkWallet(epoch,caller);
    const [childProgress,parentProgress]=await Promise.all([getSiteProgress(caller,child.id,runId),getSiteProgress(caller,parent.id,runId)]);
    if(childProgress.confirmedParentSiteIds.includes(parent.id))throw new GenLayerClientError('BUSY','This finalized prerequisite is already confirmed by the dependent site.');
    if(!parentProgress.approved)throw new GenLayerClientError('INVALID_EVIDENCE','Only a finalized approval can be re-notified.');
    const injected=provider;
    const preset=presetFor(enabled().network),consensus=preset.consensusMainContract!;
    const retryArgs=[calldataAddress(caller),runId,parent.id];
    const expectedData=abi.transactions.serialize([abi.calldata.encode(abi.calldata.makeCalldataObject('retry_dependency_notifications',retryArgs,undefined)),false]);
    let requested=false;
    const guarded:InjectedProvider={request:async args=>{
      if(args.method!=='eth_sendTransaction'){
        if(args.method!=='eth_chainId'&&args.method!=='eth_accounts')invalid();
        return injected.request(args);
      }
      if(requested)throw new GenLayerClientError('BUSY','Only one explicitly verified notification retry may be broadcast.');
      requested=true;await checkWallet(epoch,caller,injected);
      if(!args.params||args.params.length!==1)invalid();
      const tx=object(args.params[0]);
      if(normalizeAddress(tx.from as string)!==caller||normalizeAddress(tx.to as string)!==consensus.address.toLowerCase()||tx.value!=='0x0'||chainId(tx.chainId)!==enabled().chainId)invalid();
      let decoded:ReturnType<typeof decodeFunctionData>;
      try{decoded=decodeFunctionData({abi:addV5,data:tx.data as Hash});}catch{decoded=decodeFunctionData({abi:addV6,data:tx.data as Hash});}
      const fields=decoded.args;
      if(decoded.functionName!=='addTransaction'||!fields||normalizeAddress(fields[0] as string)!==caller||normalizeAddress(fields[1] as string)!==addressFor(parent.id)||
        fields[2]!==BigInt(preset.defaultNumberOfInitialValidators)||fields[3]!==BigInt(preset.defaultConsensusMaxRotations)||String(fields[4]).toLowerCase()!==expectedData.toLowerCase())invalid();
      return injected.request(args);
    }};
    const writer=options.writerFactory?.(caller,guarded)??createClient({chain:preset as unknown as NonNullable<NonNullable<Parameters<typeof createClient>[0]>['chain']>,account:caller,
      provider:guarded as NonNullable<NonNullable<Parameters<typeof createClient>[0]>['provider']>});
    await checkWallet(epoch,caller);
    return hash(await writer.writeContract({address:addressFor(parent.id),functionName:'retry_dependency_notifications',args:[calldataAddress(caller),runId,parent.id],value:0n,leaderOnly:false}));
  }
  function evmTransactionId(input: unknown, ticket: RecoveryTicket): Hash | null {
    const consensus = presetFor(enabled().network).consensusMainContract!;
    return transactionIdFromReceipt(input,ticket,consensus.address,consensus.abi);
  }
  async function reconcile(input: RecoveryTicket, externalSignal?: AbortSignal, origin: 'pending' | 'archive' = 'pending', once=false): Promise<RepairState> {
    if (!config.enabled || disposed) return state;
    if (input.prepared.expeditionId !== expedition()) return emit({ status: 'recovery-needed', message: 'This review belongs to a different expedition. Switch to that saved expedition before recovering it.' });
    if (!wallet || !provider) return emit({ status: 'recovery-needed', message: 'Connect the original wallet before explicitly recovering a saved submission.' });
    const epoch = generation, caller = wallet;
    pollController?.abort(); const controller = new AbortController(); pollController = controller;
    const cancel = () => controller.abort(); externalSignal?.addEventListener('abort', cancel, { once: true });
    if (externalSignal?.aborted) controller.abort();
    let ticket: RecoveryTicket | undefined;
    try {
      ticket = await recoveryEvidence(input, addressFor(input.prepared.siteId), nativeChainId, enabled().chainId);
      if (ticket.prepared.caller !== caller) invalid();
      await checkWallet(epoch, caller);
      await bounded(verifyProtocol(), controller.signal);
      if (origin === 'pending') save(ticket);
      const start = Date.now(); let lastStatus = 'SUBMITTED';
      for (let attempt = 0; attempt < (once?1:maxPolls) && Date.now() - start < maxPollMs; attempt++) {
        await checkWallet(epoch, caller);
        let txId: Hash | null = null;
        try {
          const evmTxHash = ticket.evmTxHash;
          const evm = await retried(() => readClient().getTransactionReceipt({ hash: evmTxHash }), controller.signal);
          txId = evmTransactionId(evm, ticket);
        } catch (error) { if (!(error instanceof TransactionReceiptNotFoundError)) throw error; }
        if (txId) {
          if (ticket.txId !== undefined && ticket.txId !== txId) invalid();
          ticket = Object.freeze({ ...ticket, txId }); if (origin === 'pending') save(ticket);
          const id = txId;
          const rawTx = await retried(() => readClient().getTransaction({ hash: id }), controller.signal);
          const tx = transactionEvidence(rawTx, ticket);
          // Display only: who reviewed it (leader, votes, models). Never an approval source.
          const votes = councilVotes(rawTx), withVotes = votes ? { votes } : {};
          lastStatus = tx.status;
          if (epoch !== generation || controller.signal.aborted || disposed) return state;
          if (tx.status === 'UNDETERMINED' || tx.status === 'LEADER_TIMEOUT' || tx.status === 'VALIDATORS_TIMEOUT') {
            // These are not proof of final rejection. Keep the original ticket
            // recoverable and block a second submission for this nonce.
            return emit({ status: 'timed-out', pending: true, ticket, lastObservedStatus: tx.status,
              message: 'GenLayer reported an unresolved or timed-out review. This is not an approval or rejection; recover this same transaction later.' });
          }
          if (tx.status === 'CANCELED') {
            if (origin === 'pending') terminalReads.add(ticket.evmTxHash);
            return emit({ status: 'failed', reason: 'canceled', ticket, message: 'The transaction was canceled. No restoration was granted.' });
          }
          if (tx.status === 'FINALIZED') {
            if (tx.execution === 'FAILED') { if (origin === 'pending') finish(ticket); return emit({ status: 'failed', reason: 'execution', ticket, message: 'Finalized execution failed. No restoration was granted.' }); }
            if (tx.consensusResult === 'NO_MAJORITY') {
              if (origin === 'pending') finish(ticket);
              return emit({ status: 'failed', reason: 'no-majority', ticket, ...withVotes,
                message: 'This review ended without a validator majority. Your build is saved and can be tested and submitted again.' });
            }
            if (tx.consensusResult === 'MAJORITY_DISAGREE') {
              if (origin === 'pending') finish(ticket);
              return emit({ status: 'failed', reason: 'execution', ticket, ...withVotes,
                message: 'GenLayer finalized this review without accepting the contract execution. No restoration was granted; you can correct and submit a fresh review.' });
            }
            emit({ status: 'finalized', execution: tx.execution, ticket });
            if (tx.execution === 'SUCCEEDED') {
              const record = await view('get_receipt', [calldataAddress(caller), ticket.prepared.expeditionId, BigInt(ticket.prepared.nonce)], controller.signal, ticket.prepared.siteId);
              if (record !== null) {
                const receipt = await receiptEvidence(record, ticket, nativeChainId, enabled().chainId);
                await checkWallet(epoch, caller);
                if (controller.signal.aborted || disposed || epoch !== generation) return state;
                if (receipt.decision === 'rejected') {
                  if (origin === 'archive') invalid();
                  finish(ticket);
                  return emit({ status: 'rejected', finality: 'FINALIZED', execution: 'SUCCEEDED', ticket, receipt: Object.freeze({ ...receipt, decision: 'rejected' }), ...withVotes });
                }
                // Never delete the pending proof before its separate approval
                // archive is durably saved. No cached decision flags are stored.
                const archived = archive(ticket);
                if (origin === 'pending' && archived) finish(ticket);
                return emit({ status: 'finalized-success', decision: 'approved', grant: Object.freeze({ mode: 'connected', finality: 'FINALIZED', execution: 'SUCCEEDED', txId,
                  evmTxHash: ticket.evmTxHash, chainId: enabled().chainId, contractAddress: ticket.contractAddress,
                  receipt: Object.freeze({ ...receipt, decision: 'approved' }) }), ...withVotes });
              }
            }
            return emit({status:'recovery-needed',ticket,message:'This review is finalized, but its successful repair receipt could not be verified. Your build is saved; it will be checked again.'});
          } else emit({ status: tx.status === 'ACCEPTED' || tx.status === 'READY_TO_FINALIZE' ? 'accepted' : 'pending', ticket });
        } else emit({ status: 'pending', ticket });
        if(once)return state;
        const wait = interval > 0 && Date.now() - start > 120_000 ? Math.max(interval, 15_000) : interval;
        if (attempt + 1 < maxPolls) await bounded(sleep(wait), controller.signal, Math.max(readTimeout, wait + 100));
      }
      if (epoch !== generation || disposed || controller.signal.aborted) return state;
      return emit({ status: 'timed-out', pending: true, ticket, lastObservedStatus: lastStatus, message: 'Bounded polling stopped; verification is incomplete. Recover this ticket later, without resubmitting.' });
    } catch (error) {
      if (epoch !== generation || disposed) return state;
      if (error instanceof GenLayerClientError && error.code === 'EVM_REVERTED' && ticket) {
        if (origin === 'pending') finish(ticket);
        return emit({ status: 'failed', reason: 'execution', ticket, message: 'The EVM submission reverted. No GenLayer repair decision or restoration was granted.' });
      }
      if (controller.signal.aborted) return emit({ status: 'recovery-needed', ...(ticket ? { ticket } : {}), message: 'Polling paused. Keep the ticket and recover explicitly; no restoration was granted.' });
      return emit({ status: error instanceof GenLayerClientError && error.code === 'INVALID_EVIDENCE' ? 'recovery-needed' : 'network-error', ...(ticket ? { ticket } : {}),
        message: 'Submission evidence could not be verified. Keep the original ticket; do not rebroadcast or adopt another draft.' });
    } finally { externalSignal?.removeEventListener('abort', cancel); }
  }
  const resume = (ticket: RecoveryTicket, signal?: AbortSignal, options?: {readonly once:boolean}) => reconcile(ticket, signal, 'pending',options?.once);
  async function reverifyApproval(input: ApprovalEvidence, signal?: AbortSignal, options?: {readonly once:boolean}): Promise<RepairState> {
    if (!config.enabled || disposed) return state;
    try {
      const evidence = await approvedBroadcastEvidence(input, addressFor(input.prepared.siteId), nativeChainId, enabled().chainId);
      return await reconcile(evidence, signal, 'archive',options?.once);
    } catch {
      return emit({ status: 'recovery-needed', message: 'Archived broadcast evidence is invalid. No restoration was granted; cached approvals are not authority.' });
    }
  }
  async function submit(prepared: PreparedRepair): Promise<RepairState> {
    if (!config.enabled || disposed) return state;
    if (writeInFlight) throw new GenLayerClientError('BUSY', 'A submission is already awaiting the wallet or being reconciled.');
    if (!registered.has(prepared) || !prepared.technicallyValid || prepared.caller !== wallet || !provider) invalid();
    if (getRecoveryTickets(prepared.caller).some((ticket) => ticket.contractAddress === addressFor(prepared.siteId) && ticket.prepared.nonce === prepared.nonce && !terminalReads.has(ticket.evmTxHash))) throw new GenLayerClientError('BUSY', 'Recover the recorded submission for this nonce before submitting again.');
    const epoch = generation, injected = provider, caller = prepared.caller;
    registered.delete(prepared); writeInFlight = true;
    let ticket: RecoveryTicket | undefined, requested = false;
    let broadcast!: (ticket: RecoveryTicket) => void;
    const broadcasted = new Promise<RecoveryTicket>((resolve) => { broadcast = resolve; });
    try {
      await checkWallet(epoch, caller);
      const site = getRepairScenario(prepared.siteId);
      const progress = await getSiteProgress(caller, site.id, prepared.expeditionId);
      if (prepared.expeditionId !== expedition() || progress.nextNonce !== prepared.nonce || progress.approved || !progress.dependencyReady) invalid();
      emit({ status: 'awaiting-wallet', prepared });
      const guarded: InjectedProvider = { request: async (args) => {
        if (args.method !== 'eth_sendTransaction') {
          if (args.method !== 'eth_chainId' && args.method !== 'eth_accounts') invalid();
          return injected.request(args);
        }
        // SDK ABI fallback must never open a second broadcast/signing request.
        if (requested) throw new GenLayerClientError('BUSY', 'Automatic wallet rebroadcast is forbidden.');
        requested = true;
        await checkWallet(epoch, caller, injected);
        if (!args.params || args.params.length !== 1) invalid();
        const tx = object(args.params[0]);
        const preset = presetFor(enabled().network);
        const consensus = preset.consensusMainContract!;
        if (normalizeAddress(tx.from as string) !== caller || normalizeAddress(tx.to as string) !== consensus.address.toLowerCase() || tx.value !== '0x0' || chainId(tx.chainId) !== enabled().chainId) invalid();
        let decoded: ReturnType<typeof decodeFunctionData>;
        try { decoded = decodeFunctionData({ abi: addV5, data: tx.data as Hash }); }
        catch { decoded = decodeFunctionData({ abi: addV6, data: tx.data as Hash }); }
        const fields = decoded.args;
        if (decoded.functionName !== 'addTransaction' || !fields || normalizeAddress(fields[0] as string) !== caller || normalizeAddress(fields[1] as string) !== addressFor(prepared.siteId) ||
            fields[2] !== BigInt(preset.defaultNumberOfInitialValidators) || fields[3] !== BigInt(preset.defaultConsensusMaxRotations) || fields[4] !== submissionData(prepared)) invalid();
        const evmTxHash = hash(await injected.request(args));
        ticket = Object.freeze({ version: 2, chainId: enabled().chainId, contractAddress: addressFor(prepared.siteId), prepared, evmTxHash });
        const persisted = save(ticket);
        if (epoch === generation && !disposed) {
          emit({ status: 'submitted', ticket });
          if (!persisted) emit({ status: 'recovery-needed', ticket, message: 'The broadcast ticket could not be saved. Preserve it before closing this session.' });
        }
        broadcast(ticket);
        return evmTxHash;
      } };
      const chain = presetFor(enabled().network) as unknown as NonNullable<NonNullable<Parameters<typeof createClient>[0]>['chain']>;
      const writer = options.writerFactory?.(caller, guarded) ?? createClient({ chain, account: caller,
        provider: guarded as NonNullable<NonNullable<Parameters<typeof createClient>[0]>['provider']> });
      const writing = writer.writeContract({ address: rpcAddressFor(prepared.siteId), functionName: 'submit_repair', args: submissionArgs(prepared), value: 0n, leaderOnly: false });
      // Wallet hash is durable before the SDK waits for its EVM receipt/GenLayer ID.
      // Post-broadcast SDK errors cannot erase that ticket or cause a rebroadcast.
      const outcome = await Promise.race([broadcasted, writing.then(() => { if (!ticket) invalid(); return ticket; })]);
      if (epoch !== generation || disposed) return state;
      return await resume(outcome);
    } catch (error) {
      if (epoch !== generation || disposed) return state;
      if (ticket) return emit({ status: 'recovery-needed', ticket, message: 'Broadcast was recorded. Recover its original ticket without signing again.' });
      if (code(error) === 4001) return emit({ status: 'wallet-rejected', message: 'Wallet submission was declined. Nothing was recorded as broadcast.' });
      return emit({ status: 'network-error', message: 'The wallet did not return a usable broadcast hash. Check wallet activity before any explicit retry.' });
    } finally { writeInFlight = false; }
  }

  return Object.freeze({ config: frozenConfig, getState: () => state,
    subscribe: (listener: (snapshot: RepairState) => void) => { listener(state); listeners.add(listener); return () => { listeners.delete(listener); }; },
    getScenarios: async () => REPAIR_SCENARIOS, connect, disconnect, setExpedition, getProgress, getSiteProgress: getProgressForSite, getRecoveryTickets, getApprovalEvidence, discoverRecovery, prepare, retryDependencyNotification, submit, resume, reverifyApproval,
    dispose: () => { disconnect(); disposed = true; listeners.clear(); },
  });
}
