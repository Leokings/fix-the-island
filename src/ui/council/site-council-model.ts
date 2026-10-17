import type { CouncilVotes, RepairState } from '../../genlayer/types';
import type { VillagePumpDesignId } from '../../genlayer/council/types';
import { VILLAGE_PUMP_DESIGN_IDS } from '../../genlayer/council/types';
import { wholeSentences } from '../../domain/feedback-text';

// What a site council has to say, built from adapter states. Display only: the
// receipt-verified world state decides restoration; this only tells the story of
// the review using the transaction's real leader output and validator votes.

export interface SiteCouncilDecision {
  readonly siteId: string;
  readonly source: 'genlayer' | 'mock';
  readonly status: 'reviewing' | 'decided' | 'split' | 'failed';
  readonly decision: 'approve' | 'revise' | null;
  /** The leader's sentence stored by the contract; empty when there is none. */
  readonly feedback: string;
  readonly votes: CouncilVotes | null;
  /** Stable per review (transaction ID), so a heard decision is not announced again. */
  readonly key: string;
  readonly design: VillagePumpDesignId | null;
}

function design(value: unknown): VillagePumpDesignId | null {
  return VILLAGE_PUMP_DESIGN_IDS.includes(value as VillagePumpDesignId) ? value as VillagePumpDesignId : null;
}

/** The council story for an adapter state, or undefined when the state says nothing new. */
export function councilDecisionFor(state: RepairState): SiteCouncilDecision | undefined {
  const base = { source: 'genlayer' as const, votes: null, feedback: '', decision: null, design: null };
  if (state.status === 'finalized-success') {
    const receipt = state.grant.receipt;
    return { ...base, siteId: receipt.siteId, status: 'decided', decision: 'approve', feedback: wholeSentences(receipt.feedback),
      votes: state.votes ?? null, key: state.grant.txId, design: design(receipt.councilResult?.chosenDesignId) };
  }
  if (state.status === 'rejected') {
    return { ...base, siteId: state.receipt.siteId, status: 'decided', decision: 'revise', feedback: wholeSentences(state.receipt.feedback),
      votes: state.votes ?? null, key: state.ticket.txId ?? state.ticket.evmTxHash, design: design(state.receipt.councilResult?.chosenDesignId) };
  }
  if (state.status === 'failed') {
    return { ...base, siteId: state.ticket.prepared.siteId, status: state.reason === 'no-majority' ? 'split' : 'failed',
      votes: state.votes ?? null, key: state.ticket.txId ?? state.ticket.evmTxHash };
  }
  if (state.status === 'submitted' || state.status === 'pending' || state.status === 'accepted' || state.status === 'finalized' || state.status === 'timed-out') {
    return { ...base, siteId: state.ticket.prepared.siteId, status: 'reviewing', key: state.ticket.evmTxHash };
  }
  return undefined;
}

/** Practice repairs never reach GenLayer; their council is a labelled mock with invented votes. */
export function mockCouncilDecision(siteId: string, pumpDesign: VillagePumpDesignId | null, status: 'reviewing' | 'decided'): SiteCouncilDecision {
  return {
    siteId, source: 'mock', status, decision: status === 'decided' ? 'approve' : null, design: pumpDesign,
    feedback: status === 'decided' ? 'Practice only: a connected review would show the leader’s real sentence here.' : '',
    votes: status === 'decided' ? { leader: { model: 'Leader', ms: 0 }, validators: [
      { model: 'Validator', vote: 'agree', ms: 0 }, { model: 'Validator', vote: 'agree', ms: 0 },
      { model: null, vote: 'idle', ms: 0 }, { model: 'Validator', vote: 'agree', ms: 0 },
    ] } : null,
    key: `mock:${siteId}:${status}`,
  };
}
