import type { CouncilResult } from './council/types';

export type Address = `0x${string}`;
export type Hash = `0x${string}`;
export type GenLayerChainId = 4221 | 61999;
export type Nonce = string;
export type SiteId = string;
export type RuleFlags = Readonly<Record<string, boolean>>;
export type Mode = 'connected' | 'practice';
export type RepairChannel = 'mechanical' | 'electrical' | 'water';
export type QuarterTurn = 0 | 1 | 2 | 3;

export interface InjectedProvider {
  request(args: { method: string; params?: readonly unknown[] }): Promise<unknown>;
  on?(event: 'accountsChanged' | 'chainChanged' | 'disconnect', listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}

export type GenLayerConfig =
  | Readonly<{ enabled: false; reason: 'unconfigured' | 'invalid-address' }>
  | Readonly<{
      enabled: true;
      contractAddress: Address;
      siteAddresses: Readonly<Record<IslandSiteId, Address>>;
      network: 'testnetBradbury' | 'studionet';
      chainId: GenLayerChainId;
      rpcUrl: 'https://rpc-bradbury.genlayer.com' | 'https://studio.genlayer.com/api';
    }>;

export interface RepairPart {
  readonly id: string;
  readonly optionId: string;
  readonly slotId: string;
  readonly orientationQuarterTurns: QuarterTurn;
  readonly settingId: string;
}

export interface RepairEndpoint {
  readonly partId: string;
  readonly portId: string;
}

export interface RepairConnection {
  readonly channel: RepairChannel;
  readonly from: RepairEndpoint;
  readonly to: RepairEndpoint;
}

export interface RepairArtifact {
  readonly schemaVersion: 'repair-v1';
  readonly parts: readonly RepairPart[];
  readonly configuration: Readonly<{ mountZoneId: string; outputModeId: string; routeId: string }>;
  readonly connections: readonly RepairConnection[];
}

export interface RepairDraft {
  readonly siteId: SiteId;
  readonly artifact: RepairArtifact;
  readonly rationale: string;
}

export interface SiteFixture {
  readonly id: SiteId;
  readonly version: string;
  readonly title: string;
  readonly councilQuestion: string;
  readonly councilFacts: readonly string[];
  readonly labels: Readonly<{
    options: Readonly<Record<string, string>>;
    settings: Readonly<Record<string, string>>;
    configuration: Readonly<Record<string, string>>;
  }>;
  readonly requires: readonly SiteId[];
  readonly options: readonly Readonly<{
    id: string;
    label: string;
    kind: string;
    facts: Readonly<Record<string, number | string>>;
    allowedSlots?: readonly string[];
    allowedSettings?: readonly string[];
    ports: readonly Readonly<{
      id: string;
      channel: RepairChannel;
      direction: 'in' | 'out' | 'bidirectional';
    }>[];
  }>[];
  readonly slotIds: readonly string[];
  readonly configurationOptions: Readonly<{
    mountZoneIds: readonly string[];
    outputModeIds: readonly string[];
    routeIds: readonly string[];
    settingIds: readonly string[];
  }>;
  readonly requirements: readonly Readonly<{ id: string; description: string }>[];
  readonly rubric: readonly Readonly<{ id: string; passCriterion: string; failCriterion: string }>[];
}

export type RepairCatalog = Pick<SiteFixture, 'options' | 'slotIds' | 'configurationOptions'>;

export type IslandSiteId = 'pier_hoist' | 'village_pump' | 'tidal_sluice' | 'creek_bridge' |
  'coast_windmill' | 'woodland_pathlight' | 'upland_waterworks' | 'ridge_beacon';
export interface IslandSiteFixture extends SiteFixture {
  readonly id: IslandSiteId;
  readonly family: IslandSiteId;
  readonly budget: number;
  readonly initialArtifact: RepairArtifact;
  readonly technical: Readonly<{
    requiredEdges: readonly (readonly string[])[];
    designs?: readonly Readonly<{
      id: string;
      budget: number;
      slotIds: readonly string[];
      mountZoneId: string;
      outputModeId: string;
      routeId: string;
      requiredEdges: readonly (readonly string[])[];
      operation: string;
      [key: string]: unknown;
    }>[];
    [key: string]: unknown;
  }>;
}
export interface LocalRepairAdvice {
  readonly mode: 'advisory';
  readonly valid: boolean;
  readonly flags: RuleFlags;
  readonly materialCost: number;
  readonly budget: number;
  readonly designId?: string | null;
  readonly metrics: Readonly<Record<string, number>>;
  readonly feedback: readonly string[];
}

export interface RepairBinding {
  readonly chainId: GenLayerChainId;
  /** Native GenVM message context, distinct from the wallet/RPC network. */
  readonly nativeChainId?: 1 | GenLayerChainId;
  readonly contractAddress: Address;
  readonly caller: Address;
  /** Random per-game namespace; a fresh expedition never inherits old approvals. */
  readonly expeditionId: Hash;
  readonly fixtureVersion: string;
  readonly siteId: SiteId;
  readonly nonce: Nonce;
}

export interface PreparedRepair extends RepairDraft {
  readonly caller: Address;
  readonly expeditionId: Hash;
  readonly nonce: Nonce;
  readonly digest: Hash;
  readonly fixtureVersion: string;
  readonly technicalFlags: RuleFlags;
  readonly technicallyValid: boolean;
}

export interface RepairReceipt extends RepairDraft {
  readonly caller: Address;
  readonly expeditionId: Hash;
  readonly nonce: Nonce;
  readonly digest: Hash;
  readonly fixtureVersion: string;
  readonly decision: 'approved' | 'rejected';
  readonly technicalFlags: RuleFlags;
  readonly contextFlags: RuleFlags | null;
  readonly feedback: string;
  /** Present only on a finalized village-pump review; its decision gates approval. */
  readonly councilResult?: CouncilResult;
  readonly evidenceQuote?: string;
}

export interface RecoveryTicket {
  readonly version: 2;
  readonly chainId: GenLayerChainId;
  readonly contractAddress: Address;
  readonly prepared: PreparedRepair;
  readonly evmTxHash: Hash;
  readonly txId?: Hash;
}

/** Original broadcast proof only. Cached approval/context booleans are not evidence. */
export interface ApprovalEvidence extends RecoveryTicket {
  readonly kind: 'approved-broadcast-v1';
  readonly txId: Hash;
}

export interface RestorationGrant {
  readonly mode: 'connected';
  readonly finality: 'FINALIZED';
  readonly execution: 'SUCCEEDED';
  readonly txId: Hash;
  readonly evmTxHash: Hash;
  readonly contractAddress: Address;
  readonly chainId: GenLayerChainId;
  readonly receipt: RepairReceipt & Readonly<{ decision: 'approved' }>;
}

/**
 * Display-only record of who reviewed a finalized transaction, read from its
 * consensus data. GenLayer stores the leader's output and each validator's vote
 * and model; validators' own reasoning is not stored. Never an approval source.
 */
export type CouncilVote = 'agree' | 'disagree' | 'idle' | 'timeout';
export interface CouncilVotes {
  readonly leader: Readonly<{ model: string | null; ms: number }> | null;
  readonly validators: readonly Readonly<{ model: string | null; vote: CouncilVote; ms: number }>[];
  /** When the review was submitted (ms since epoch), if the transaction says. */
  readonly at?: number;
}

export type RepairState =
  | Readonly<{ status: 'disabled'; reason: string }>
  | Readonly<{ status: 'disconnected' }>
  | Readonly<{ status: 'ready'; wallet: Address }>
  | Readonly<{ status: 'queued' | 'awaiting-wallet'; prepared: PreparedRepair }>
  | Readonly<{ status: 'submitted' | 'pending' | 'accepted'; ticket: RecoveryTicket }>
  | Readonly<{ status: 'finalized'; ticket: RecoveryTicket; execution: 'UNKNOWN' | 'SUCCEEDED' }>
  | Readonly<{ status: 'finalized-success'; decision: 'approved'; grant: RestorationGrant; votes?: CouncilVotes }>
  | Readonly<{
      status: 'rejected'; finality: 'FINALIZED'; execution: 'SUCCEEDED';
      ticket: RecoveryTicket; receipt: RepairReceipt & Readonly<{ decision: 'rejected' }>; votes?: CouncilVotes;
    }>
  | Readonly<{
      status: 'failed'; reason: 'execution' | 'undetermined' | 'no-majority' | 'canceled' | 'leader-timeout' | 'validators-timeout';
      ticket: RecoveryTicket; message: string; votes?: CouncilVotes;
    }>
  | Readonly<{ status: 'timed-out'; pending: true; ticket: RecoveryTicket; lastObservedStatus: string; message: string }>
  | Readonly<{ status: 'wallet-rejected'; message: string }>
  | Readonly<{ status: 'wrong-network'; expectedChainId: GenLayerChainId; actualChainId?: number }>
  | Readonly<{ status: 'network-error' | 'recovery-needed'; message: string; ticket?: RecoveryTicket }>;

export interface GenLayerAdapter {
  readonly config: GenLayerConfig;
  getState(): RepairState;
  subscribe(listener: (state: RepairState) => void): () => void;
  getScenarios(): Promise<readonly SiteFixture[]>;
  connect(provider: InjectedProvider): Promise<RepairState>;
  /** Bind subsequent reads, preparations, submissions and recovery to one game run. */
  setExpedition(expeditionId: Hash): void;
  disconnect(): void;
  getProgress(caller: Address, siteId?: SiteId): Promise<{ nextNonce: Nonce; approvedSiteIds: readonly SiteId[]; dependencyReady: boolean; requiredParentSiteIds: readonly SiteId[]; confirmedParentSiteIds: readonly SiteId[] }>;
  /** Read only the inspected site's finalized progress; avoids a full-network fan-out for UI polling. */
  getSiteProgress(caller: Address, siteId: SiteId): Promise<{ nextNonce: Nonce; approved: boolean; dependencyReady: boolean; requiredParentSiteIds: readonly SiteId[]; confirmedParentSiteIds: readonly SiteId[] }>;
  getRecoveryTickets(caller: Address): readonly RecoveryTicket[];
  /** Untrusted cache suggestions in fixed dependency order; no RPC and no grant. */
  getApprovalEvidence(caller: Address): readonly ApprovalEvidence[];
  /** Read-only discovery from the active network; results confer no progress. */
  discoverRecovery(caller: Address, signal?: AbortSignal): Promise<readonly RecoveryTicket[]>;
  /** Permissionless, explicit retry of a finalized prerequisite's pending child notification. */
  retryDependencyNotification(parentSiteId: SiteId, childSiteId: SiteId): Promise<Hash>;
  prepare(draft: RepairDraft): Promise<PreparedRepair>;
  submit(prepared: PreparedRepair): Promise<RepairState>;
  resume(ticket: RecoveryTicket, signal?: AbortSignal, options?: { readonly once: boolean }): Promise<RepairState>;
  /** Explicit original-proof reconciliation. Read-only; never signs or creates a pending ticket. */
  reverifyApproval(evidence: ApprovalEvidence, signal?: AbortSignal, options?: { readonly once: boolean }): Promise<RepairState>;
  dispose(): void;
}
