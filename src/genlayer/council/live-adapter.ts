/**
 * Projects the finalized village-pump repair receipt into the council UI.
 * There is deliberately no second council contract or review transaction.
 */
import { assertCouncilResult, COUNCIL_SCHEMA_VERSION, type CouncilPresentation } from './types';
import type { RepairReceipt, RepairState } from '../types';
import { getRepairScenario } from '../catalog';

// A caller-provided `source: 'genlayer'` label is not proof. Only this module's
// projection from the adapter's verified finalized state can set provenance.
const verifiedPresentations = new WeakSet<object>();

export function isVerifiedCouncilPresentation(value: CouncilPresentation): boolean {
  return value.source === 'genlayer' && value.status === 'finalized' && verifiedPresentations.has(value);
}

type FinalPumpReview = Extract<RepairState, { status: 'finalized-success' | 'rejected' }>;

/**
 * Projects the council result already stored in a finalized pump repair receipt.
 * The repair adapter emits these terminal states only after checking finality,
 * successful execution, transaction receipt, sender and contract bindings.
 * The returned object is display-only; restoration authority remains the grant.
 */
export function projectFinalizedPumpCouncilPresentation(state: FinalPumpReview): CouncilPresentation | null {
  const receipt: RepairReceipt = state.status === 'finalized-success' ? state.grant.receipt : state.receipt;
  if (receipt.siteId !== 'village_pump' || !receipt.councilResult) return null;
  try { assertCouncilResult(receipt.councilResult); } catch { return null; }

  const result = receipt.councilResult;
  const slots = new Set(receipt.artifact.parts.map(part => part.slotId));
  const design = getRepairScenario('village_pump').technical.designs?.find(candidate =>
    candidate.slotIds.length === slots.size && candidate.slotIds.every(slot => slots.has(slot)) &&
    candidate.mountZoneId === receipt.artifact.configuration.mountZoneId &&
    candidate.outputModeId === receipt.artifact.configuration.outputModeId &&
    candidate.routeId === receipt.artifact.configuration.routeId);
  const txId = state.status === 'finalized-success' ? state.grant.txId : state.ticket.txId;
  const evmTxHash = state.status === 'finalized-success' ? state.grant.evmTxHash : state.ticket.evmTxHash;
  const contractAddress = state.status === 'finalized-success' ? state.grant.contractAddress : state.ticket.contractAddress;
  const chainId = state.status === 'finalized-success' ? state.grant.chainId : state.ticket.chainId;
  if (!txId || (chainId !== 4221 && chainId !== 61999) || !design || result.chosenDesignId !== design.id ||
      receipt.decision !== (result.decision === 'approve' ? 'approved' : 'rejected')) return null;

  const presentation: CouncilPresentation = Object.freeze({
    schemaVersion: COUNCIL_SCHEMA_VERSION,
    source: 'genlayer',
    authority: 'display-only',
    siteId: 'village_pump',
    chosenDesignId: result.chosenDesignId,
    status: 'finalized',
    message: 'Finalized village-pump council assessment verified in the repair receipt.',
    result,
    proof: Object.freeze({ chainId, contractAddress, txId, evmTxHash,
      pumpContractAddress: contractAddress, pumpDigest: receipt.digest,
      ...(receipt.evidenceQuote ? { evidenceQuote: receipt.evidenceQuote } : {}), feedback: receipt.feedback }),
  });
  verifiedPresentations.add(presentation);
  return presentation;
}
