import { describe, expect, it } from 'vitest';
import { VILLAGE_PUMP_COUNCIL_MOCKS } from '../src/genlayer/council/mock-fixtures';
import { isVerifiedCouncilPresentation, projectFinalizedPumpCouncilPresentation } from '../src/genlayer/council/live-adapter';
import { createRepairExampleDraft } from '../src/genlayer/examples';
import type { RepairState } from '../src/genlayer/types';

function finalizedPumpState(): Extract<RepairState, { status: 'finalized-success' }> {
  const draft = createRepairExampleDraft('village_pump', 'valid');
  const sample = VILLAGE_PUMP_COUNCIL_MOCKS.approveAcceptable;
  if (sample.status !== 'finalized') throw new Error('Expected finalized mock fixture');
  const receipt = {
    ...draft,
    caller: '0x1111111111111111111111111111111111111111' as const,
    expeditionId: `0x${'e'.repeat(64)}` as const,
    nonce: '0',
    digest: `0x${'1'.repeat(64)}` as const,
    fixtureVersion: 'island-2026-10-13-v2',
    decision: 'approved' as const,
    technicalFlags: { schema: true, inventory: true, budget: true, connections: true, operation: true },
    contextFlags: { inventory: true, budget: true, connections: true, operation: true },
    feedback: 'Assessment complete.',
    councilResult: sample.result,
    evidenceQuote: 'urgent water shortage',
  };
  return {
    status: 'finalized-success', decision: 'approved',
    grant: {
      mode: 'connected', finality: 'FINALIZED', execution: 'SUCCEEDED', chainId: 4221,
      contractAddress: '0x2222222222222222222222222222222222222222',
      txId: `0x${'3'.repeat(64)}`,
      evmTxHash: `0x${'2'.repeat(64)}`,
      receipt,
    },
  };
}

describe('integrated pump council result projection', () => {
  it('projects the council assessment from the finalized repair receipt, without a second review ticket', () => {
    const state = finalizedPumpState();
    const presentation = projectFinalizedPumpCouncilPresentation(state);
    expect(presentation).toMatchObject({
      source: 'genlayer', authority: 'display-only', status: 'finalized',
      result: state.grant.receipt.councilResult,
      proof: { chainId: 4221, txId: state.grant.txId, evmTxHash: state.grant.evmTxHash },
    });
    expect(presentation && isVerifiedCouncilPresentation(presentation)).toBe(true);
  });

  it('does not present rejected, non-pump, or council-less results as verified', () => {
    const state = finalizedPumpState();
    expect(projectFinalizedPumpCouncilPresentation({ status: 'rejected', finality: 'FINALIZED', execution: 'SUCCEEDED',
      ticket: { version: 2, chainId: 4221, contractAddress: state.grant.contractAddress,
        prepared: { ...state.grant.receipt, technicallyValid: true }, evmTxHash: state.grant.evmTxHash,
        txId: state.grant.txId }, receipt: { ...state.grant.receipt, decision: 'rejected' } })).toBeNull();
    expect(projectFinalizedPumpCouncilPresentation({ ...state,
      grant: { ...state.grant, receipt: { ...state.grant.receipt, siteId: 'pier_hoist' } } })).toBeNull();
    const { councilResult: _councilResult, evidenceQuote: _evidenceQuote, ...withoutCouncil } = state.grant.receipt;
    expect(projectFinalizedPumpCouncilPresentation({ ...state,
      grant: { ...state.grant, receipt: withoutCouncil } })).toBeNull();
  });

  it('rejects a forged source label that was not projected from verified adapter state', () => {
    const sample = VILLAGE_PUMP_COUNCIL_MOCKS.approveAcceptable;
    const forged = { ...sample, source: 'genlayer' as const };
    expect(isVerifiedCouncilPresentation(forged)).toBe(false);
  });
});
