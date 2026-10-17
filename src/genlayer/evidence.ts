import { abi } from 'genlayer-js';
import { CalldataAddress, executionResultNumberToName, transactionResultNumberToName, transactionsStatusNumberToName } from 'genlayer-js/types';
import { decodeEventLog, type Abi } from 'viem';
import { FIXTURE_VERSION, getRepairScenario } from './catalog';
import { canonicalizeRepairArtifact, digestRepairSubmission } from './canonical';
import { createRepairArtifact, normalizeAddress, normalizeNonce, normalizeRationale } from './schema';
import { GenLayerClientError } from './config';
import { validateRepairLocally } from './advisory';
import type { Address, ApprovalEvidence, GenLayerChainId, Hash, PreparedRepair, RecoveryTicket, RepairReceipt, RuleFlags } from './types';
import { materializeCouncilResult, type CouncilResult } from './council/types';

export const TECHNICAL_FLAGS = ['schema', 'inventory', 'budget', 'connections', 'operation', 'dependencies', 'nonce', 'newSite'] as const;
export const CONTEXT_FLAGS = ['groundedInArtifact', 'explainsTradeoff', 'protectsHabitat', 'safeUseAndMaintenance'] as const;
export function invalid(): never { throw new GenLayerClientError('INVALID_EVIDENCE', 'Chain evidence does not match the frozen repair submission.'); }
export function normalizeEvmReceiptStatus(value: unknown): 'success' | 'reverted' | 'unknown' {
  if (value === 'success' || value === '0x1' || value === 1) return 'success';
  if (value === 'reverted' || value === '0x0' || value === 0) return 'reverted';
  return 'unknown';
}
export function transactionIdFromReceipt(input: unknown, ticket: RecoveryTicket, consensusAddress: Address, consensusAbi: readonly unknown[]): Hash | null {
  const receipt=object(input);
  if(hash(receipt.transactionHash)!==ticket.evmTxHash)invalid();
  const status=normalizeEvmReceiptStatus(receipt.status);
  if(status==='reverted')throw new GenLayerClientError('EVM_REVERTED','EVM submission reverted; it produced no GenLayer approval.');
  if(status!=='success'||!Array.isArray(receipt.logs)||receipt.logs.length>256)invalid();
  const ids=new Set<Hash>();
  for(const entry of receipt.logs) {
    const log=object(entry);
    if(typeof log.address!=='string')continue;
    const address=normalizeAddress(log.address);
    if(address!==normalizeAddress(consensusAddress)&&address!==ticket.contractAddress)continue;
    try {
      const decoded=decodeEventLog({abi:consensusAbi as Abi,data:log.data as Hash,topics:log.topics as [Hash,...Hash[]]});
      if(decoded.eventName==='NewTransaction') {
        const args=object(decoded.args);
        if(normalizeAddress(args.recipient as string)!==ticket.contractAddress||normalizeAddress(args.activator as string)!==ticket.prepared.caller)invalid();
        ids.add(hash(args.txId));
      } else if(decoded.eventName==='CreatedTransaction'&&address===normalizeAddress(consensusAddress)) {
        ids.add(hash(object(decoded.args).txId));
      }
    } catch(error) {if(error instanceof GenLayerClientError)throw error;/* Other system logs are irrelevant. */}
  }
  if(ids.size>1)invalid();
  return [...ids][0]??null;
}
export function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) invalid();
  if (Object.getOwnPropertySymbols(value).length || Object.values(Object.getOwnPropertyDescriptors(value)).some((descriptor) => !('value' in descriptor))) invalid();
  return value as Record<string, unknown>;
}
export function hash(value: unknown): Hash {
  if (typeof value !== 'string' || value.length !== 66 || /[^a-fA-F0-9]/.test(value.slice(2)) || !value.startsWith('0x') || /^0x0{64}$/.test(value)) invalid();
  return value.toLowerCase() as Hash;
}
export function flags(value: unknown, names: readonly string[]): RuleFlags {
  const input = object(value);
  if (Object.keys(input).length !== names.length || names.some((key) => !Object.hasOwn(input, key) || typeof input[key] !== 'boolean')) invalid();
  return Object.freeze(Object.fromEntries(names.map((key) => [key, input[key] as boolean])));
}
export async function sha256(text: string): Promise<Hash> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return `0x${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}
export function calldataAddress(address: Address): CalldataAddress {
  return new CalldataAddress(Uint8Array.from(address.slice(2).match(/../g)!, (byte) => Number.parseInt(byte, 16)));
}
export function submissionArgs(prepared: PreparedRepair) {
  return [prepared.expeditionId, prepared.siteId, canonicalizeRepairArtifact(prepared.artifact), prepared.rationale, BigInt(prepared.nonce)];
}
export function submissionData(prepared: PreparedRepair): Hash {
  return abi.transactions.serialize([abi.calldata.encode(abi.calldata.makeCalldataObject('submit_repair', submissionArgs(prepared), undefined)), false]);
}
export async function preparedEvidence(input: unknown, contractAddress: Address, nativeChainId: 1 | GenLayerChainId = 4221, chainId: GenLayerChainId = 4221): Promise<PreparedRepair> {
  const value = object(input);
  if (typeof value.siteId !== 'string' || value.fixtureVersion !== FIXTURE_VERSION || typeof value.technicallyValid !== 'boolean') invalid();
  const site = getRepairScenario(value.siteId);
  const artifact = createRepairArtifact(value.artifact as PreparedRepair['artifact'], site);
  const caller = normalizeAddress(value.caller as string), expeditionId = hash(value.expeditionId), nonce = normalizeNonce(value.nonce as string), rationale = normalizeRationale(value.rationale as string);
  const technicalFlags = flags(value.technicalFlags, TECHNICAL_FLAGS);
  const local = validateRepairLocally(site.id, artifact);
  if (Object.entries(local.flags).some(([name, valid]) => technicalFlags[name] !== valid)) invalid();
  if (Object.values(technicalFlags).every(Boolean) !== value.technicallyValid) invalid();
  const digest = await digestRepairSubmission({ chainId, nativeChainId, contractAddress, caller, expeditionId, siteId: site.id, nonce, fixtureVersion: FIXTURE_VERSION }, artifact, rationale);
  if (hash(value.digest) !== digest) invalid();
  return Object.freeze({ siteId: site.id, artifact, rationale, caller, expeditionId, nonce, digest, fixtureVersion: FIXTURE_VERSION, technicalFlags, technicallyValid: value.technicallyValid });
}
export async function recoveryEvidence(input: unknown, contractAddress: Address, nativeChainId: 1 | GenLayerChainId = 4221, chainId: GenLayerChainId = 4221): Promise<RecoveryTicket> {
  const value = object(input);
  if (value.version !== 2 || value.chainId !== chainId || normalizeAddress(value.contractAddress as string) !== contractAddress) invalid();
  const prepared = await preparedEvidence(value.prepared, contractAddress, nativeChainId, chainId);
  return Object.freeze({ version: 2, chainId, contractAddress, prepared, evmTxHash: hash(value.evmTxHash),
    ...(value.txId === undefined ? {} : { txId: hash(value.txId) }) });
}
export function archiveShape(input: unknown): Record<string, unknown> {
  const value = object(input);
  const names = ['kind', 'version', 'chainId', 'contractAddress', 'prepared', 'evmTxHash', 'txId'];
  if (value.kind !== 'approved-broadcast-v1' || Object.keys(value).length !== names.length || names.some((name) => !Object.hasOwn(value, name))) invalid();
  const prepared = object(value.prepared);
  const fields = ['siteId', 'artifact', 'rationale', 'caller', 'expeditionId', 'nonce', 'digest', 'fixtureVersion', 'technicalFlags', 'technicallyValid'];
  if (Object.keys(prepared).length !== fields.length || fields.some((name) => !Object.hasOwn(prepared, name)) || prepared.technicallyValid !== true) invalid();
  return value;
}
export async function approvedBroadcastEvidence(input: unknown, contractAddress: Address, nativeChainId: 1 | GenLayerChainId = 4221, chainId: GenLayerChainId = 4221): Promise<ApprovalEvidence> {
  const value = archiveShape(input);
  const ticket = await recoveryEvidence(value, contractAddress, nativeChainId, chainId);
  if (!ticket.txId || !ticket.prepared.technicallyValid) invalid();
  return Object.freeze({ ...ticket, kind: 'approved-broadcast-v1', txId: ticket.txId });
}
export async function receiptEvidence(input: unknown, ticket: RecoveryTicket, nativeChainId: 1 | GenLayerChainId = 4221, chainId: GenLayerChainId = 4221): Promise<RepairReceipt> {
  const stored = object(input), prepared = ticket.prepared;
  // Contracts key receipts by (caller, expeditionId, nonce) and do not repeat the
  // expedition inside the record. Bind it from the ticket: preparedEvidence below
  // recomputes the digest over it, so a receipt from another expedition fails.
  if (stored.expeditionId !== undefined && stored.expeditionId !== prepared.expeditionId) invalid();
  const record: Record<string, unknown> = { ...stored, expeditionId: prepared.expeditionId };
  if (record.siteId !== prepared.siteId || record.caller !== prepared.caller || record.nonce !== prepared.nonce || record.digest !== prepared.digest || record.fixtureVersion !== FIXTURE_VERSION) invalid();
  const candidate = await preparedEvidence({ ...record, technicallyValid: Object.values(flags(record.technicalFlags, TECHNICAL_FLAGS)).every(Boolean) }, ticket.contractAddress, nativeChainId, chainId);
  if (candidate.caller !== prepared.caller || candidate.expeditionId !== prepared.expeditionId || candidate.siteId !== prepared.siteId || candidate.nonce !== prepared.nonce || candidate.digest !== prepared.digest) invalid();
  if (record.decision !== 'approved' && record.decision !== 'rejected') invalid();
  const contextFlags = record.contextFlags === null ? null : flags(record.contextFlags, CONTEXT_FLAGS);
  const approved = candidate.technicallyValid && contextFlags !== null && Object.values(contextFlags).every(Boolean);
  if ((record.decision === 'approved') !== approved || (candidate.technicallyValid ? contextFlags === null : contextFlags !== null)) invalid();
  let councilResult: CouncilResult | undefined;
  let evidenceQuote: string | undefined;
  if (candidate.siteId === 'village_pump' && candidate.technicallyValid) {
    try { councilResult = materializeCouncilResult(record.councilResult); } catch { invalid(); }
    if (councilResult.chosenDesignId !== record.designId ||
        (councilResult.decision === 'approve') !== (record.decision === 'approved') ||
        !contextFlags || Object.values(contextFlags).some(value => value !== (record.decision === 'approved'))) invalid();
    const optionalQuote = record.evidenceQuote;
    if (typeof optionalQuote === 'string' && optionalQuote.length >= 8 && optionalQuote.length <= 160) evidenceQuote = optionalQuote;
    if (typeof record.feedback !== 'string' || !record.feedback.trim()) invalid();
  } else if (record.councilResult !== undefined || record.evidenceQuote !== undefined) invalid();
  if (typeof record.feedback !== 'string' || Array.from(record.feedback).length < 1 || Array.from(record.feedback).length > 240 || /[\uD800-\uDFFF]/u.test(record.feedback.replace(/[\u{10000}-\u{10FFFF}]/gu, ''))) invalid();
  return Object.freeze({ siteId: candidate.siteId, artifact: candidate.artifact, rationale: candidate.rationale,
    caller: candidate.caller, expeditionId: candidate.expeditionId, nonce: candidate.nonce, digest: candidate.digest, fixtureVersion: FIXTURE_VERSION,
    technicalFlags: candidate.technicalFlags, contextFlags, decision: record.decision, feedback: record.feedback,
    ...(councilResult ? { councilResult, ...(evidenceQuote ? { evidenceQuote } : {}) } : {}) });
}
export function transactionEvidence(input: unknown, ticket: RecoveryTicket): { status: string; execution: 'SUCCEEDED' | 'FAILED' | 'UNKNOWN'; consensusResult?: string } {
  const tx = object(input);
  const txId = tx.txId ?? tx.tx_id;
  const sender = tx.sender ?? tx.from_address;
  const recipient = tx.recipient ?? tx.to_address;
  if (!ticket.txId || hash(txId) !== ticket.txId || normalizeAddress(sender as string) !== ticket.prepared.caller || normalizeAddress(recipient as string) !== ticket.contractAddress) invalid();
  const rawData = tx.txData ?? tx.txCalldata ?? tx.tx_data;
  const data = typeof rawData === 'string' && !rawData.startsWith('0x') ? `0x${rawData}` : rawData;
  if (typeof data !== 'string' || data.toLowerCase() !== submissionData(ticket.prepared).toLowerCase() ||
      (tx.txData != null && tx.txCalldata != null && tx.txData !== tx.txCalldata)) invalid();
  const status = transactionsStatusNumberToName[String(tx.status) as keyof typeof transactionsStatusNumberToName] ?? tx.status_name;
  const suppliedStatusName = tx.statusName ?? tx.status_name;
  if (typeof status !== 'string' || (suppliedStatusName !== undefined && suppliedStatusName !== status)) invalid();
  const executionName = executionResultNumberToName[String(tx.txExecutionResult) as keyof typeof executionResultNumberToName];
  if (tx.txExecutionResultName !== undefined && tx.txExecutionResultName !== executionName) invalid();
  const consensusResultName = transactionResultNumberToName[String(tx.result) as keyof typeof transactionResultNumberToName];
  const suppliedConsensusResult = tx.resultName ?? tx.result_name;
  if (consensusResultName && suppliedConsensusResult !== undefined && suppliedConsensusResult !== consensusResultName) invalid();
  const consensusResult = consensusResultName ?? suppliedConsensusResult;
  if (consensusResult !== undefined && (typeof consensusResult !== 'string' || !Object.values(transactionResultNumberToName).includes(consensusResult as never))) invalid();
  const consensus = tx.consensus_data;
  const leaderReceipts = typeof consensus === 'object' && consensus !== null && !Array.isArray(consensus)
    ? (consensus as Record<string, unknown>).leader_receipt : undefined;
  const successfulStudioExecution = (tx.result_name ?? tx.resultName) === 'MAJORITY_AGREE' && Array.isArray(leaderReceipts) &&
    leaderReceipts.some((item) => typeof item === 'object' && item !== null &&
      (item as Record<string, unknown>).execution_result === 'SUCCESS' &&
      typeof (item as Record<string, unknown>).genvm_result === 'object' &&
      (item as Record<string, unknown>).genvm_result !== null &&
      ((item as Record<string, unknown>).genvm_result as Record<string, unknown>).error_code == null);
  const execution = executionName === 'FINISHED_WITH_RETURN' || successfulStudioExecution ? 'SUCCEEDED'
    : executionName === 'FINISHED_WITH_ERROR' || (status === 'FINALIZED' && (tx.result_name ?? tx.resultName) === 'MAJORITY_DISAGREE') ? 'FAILED' : 'UNKNOWN';
  return { status, execution, ...(consensusResult ? { consensusResult } : {}) };
}
