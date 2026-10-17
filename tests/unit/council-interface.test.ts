import { describe, expect, it } from 'vitest';
import { assertCouncilResult, COUNCIL_CONSENSUS_FIELDS, COUNCIL_ROLES, DESIGN_CONSEQUENCES } from '../../src/genlayer/council/types';
import { VILLAGE_PUMP_COUNCIL_MOCKS as samples } from '../../src/genlayer/council/mock-fixtures';
import { isVerifiedCouncilPresentation, projectFinalizedPumpCouncilPresentation } from '../../src/genlayer/council/live-adapter';
import { createRepairExampleDraft } from '../../src/genlayer/examples';
import type { RepairState } from '../../src/genlayer/types';

const cloneResult = () => {
  const sample = samples.approveGood;
  if (sample.status !== 'finalized') throw new Error('Expected completed mock');
  return JSON.parse(JSON.stringify(sample.result));
};
describe('council UI contract (not chain verification)', () => {
  it('keeps only the suitability decision in validator consensus', () => {
    expect(COUNCIL_CONSENSUS_FIELDS).toEqual(['decision']);
  });
  it('provides all five requested outcomes plus processing/failure samples', () => {
    expect(Object.keys(samples)).toEqual(['approveAcceptable','approveGood','approveExcellent','revise','timeout','pending','accepted','failed']);
    for (const sample of Object.values(samples)) {
      expect(sample.source).toBe('mock'); expect(sample.authority).toBe('display-only');
      expect(sample.message).toContain('MOCK PREVIEW');
      expect(sample).not.toHaveProperty('grant'); expect(sample).not.toHaveProperty('txId');
      if (sample.status === 'finalized') {
        expect(() => assertCouncilResult(sample.result)).not.toThrow();
        expect(sample.result.chosenDesignId).toBe(sample.chosenDesignId);
        expect(sample.result.perspectives.map(p => p.role)).toEqual(COUNCIL_ROLES);
      } else expect(sample.result).toBeNull();
    }
  });
  it('timeout has no assessment and only read-only recovery', () => {
    expect(samples.timeout.result).toBeNull();
    expect(samples.timeout.recoveryAction).toBe('check_existing_transaction');
    expect(samples.failed.result).toBeNull();
  });
  it('does not treat a caller-supplied genlayer label as verifier provenance', () => {
    const forged = { ...samples.approveGood, source: 'genlayer' as const };
    expect(isVerifiedCouncilPresentation(forged)).toBe(false);
    expect(isVerifiedCouncilPresentation(samples.approveGood)).toBe(false);
  });
  it('projects only a finalized pump receipt whose selected design matches its real build', () => {
    const draft = createRepairExampleDraft('village_pump', 'valid');
    const result = samples.approveAcceptable.result;
    if (!result) throw new Error('Expected finalized mock result fixture');
    const receipt = { ...draft, caller: '0x1111111111111111111111111111111111111111' as const, expeditionId: `0x${'d'.repeat(64)}` as `0x${string}`,
      nonce: '0', digest: `0x${'1'.repeat(64)}` as const, fixtureVersion: 'island-2026-10-13-v2',
      decision: 'approved' as const, technicalFlags: { schema: true, inventory: true, budget: true, connections: true, operation: true },
      contextFlags: { inventory: true, budget: true, connections: true, operation: true }, feedback: 'Assessment complete.',
      councilResult: result, evidenceQuote: 'urgent water shortage' };
    const state = { status: 'finalized-success' as const, decision: 'approved' as const,
      grant: { mode: 'connected' as const, finality: 'FINALIZED' as const, execution: 'SUCCEEDED' as const,
        chainId: 4221 as const, contractAddress: '0x2222222222222222222222222222222222222222' as const,
        txId: `0x${'3'.repeat(64)}` as const, evmTxHash: `0x${'2'.repeat(64)}` as const, receipt } } satisfies RepairState;
    const projected = projectFinalizedPumpCouncilPresentation(state);
    expect(projected?.result).toEqual(result);
    expect(projected?.source).toBe('genlayer');
    expect(projected && isVerifiedCouncilPresentation(projected)).toBe(true);

    const { evidenceQuote: _evidenceQuote, ...receiptWithoutQuote } = receipt;
    const quoteOmitted = projectFinalizedPumpCouncilPresentation({ ...state, grant: { ...state.grant,
      receipt: receiptWithoutQuote } });
    expect(quoteOmitted?.result).toEqual(result);
    expect(quoteOmitted?.proof).not.toHaveProperty('evidenceQuote');
    expect(quoteOmitted && isVerifiedCouncilPresentation(quoteOmitted)).toBe(true);

    const mismatched = { ...state, grant: { ...state.grant, receipt: { ...receipt,
      councilResult: { ...result, chosenDesignId: 'quiet_pump' as const } } } };
    expect(projectFinalizedPumpCouncilPresentation(mismatched)).toBeNull();
  });
  it('does not project receipts from other sites or receipts without the council assessment', () => {
    const draft = createRepairExampleDraft('village_pump', 'valid');
    const result = samples.approveAcceptable.result;
    if (!result) throw new Error('Expected finalized mock result fixture');
    const state = { status: 'finalized-success' as const, decision: 'approved' as const,
      grant: { mode: 'connected' as const, finality: 'FINALIZED' as const, execution: 'SUCCEEDED' as const,
        chainId: 4221 as const, contractAddress: '0x2222222222222222222222222222222222222222' as const,
        txId: `0x${'3'.repeat(64)}` as const, evmTxHash: `0x${'2'.repeat(64)}` as const,
        receipt: { ...draft, caller: '0x1111111111111111111111111111111111111111' as const, expeditionId: `0x${'d'.repeat(64)}` as `0x${string}`,
          nonce: '0', digest: `0x${'1'.repeat(64)}` as const, fixtureVersion: 'island-2026-10-13-v2',
          decision: 'approved' as const, technicalFlags: {}, contextFlags: {}, feedback: 'Assessment complete.',
          councilResult: result, evidenceQuote: 'urgent water shortage' } } } satisfies RepairState;
    const receiptWithoutCouncil = Object.fromEntries(Object.entries(state.grant.receipt)
      .filter(([key]) => key !== 'councilResult' && key !== 'evidenceQuote')) as typeof state.grant.receipt;
    expect(projectFinalizedPumpCouncilPresentation({ ...state, grant: { ...state.grant,
      receipt: receiptWithoutCouncil } })).toBeNull();
    expect(projectFinalizedPumpCouncilPresentation({ ...state, grant: { ...state.grant,
      receipt: { ...state.grant.receipt, siteId: 'pier_hoist' } } })).toBeNull();
  });
  it('does not hardcode grade or consequences from prose', () => {
    expect(samples.approveGood.result?.chosenDesignId).toBe(samples.approveExcellent.result?.chosenDesignId);
    expect(samples.approveGood.result?.quality).not.toBe(samples.approveExcellent.result?.quality);
    expect(samples.approveGood.result?.consequences).toEqual(samples.approveExcellent.result?.consequences);
    expect(Object.isFrozen(DESIGN_CONSEQUENCES.quiet_pump)).toBe(true);
  });
  it.each(['unknown','__proto__', null])('rejects unregistered design %s', design => {
    const result = cloneResult(); result.chosenDesignId = design;
    expect(() => assertCouncilResult(result)).toThrow();
  });
  it('rejects duplicate roles, unknown stances and long text', () => {
    for (const change of [
      (r: any) => { r.perspectives[1].role = 'fisher'; },
      (r: any) => { r.perspectives[0].stance = 'voted_yes'; },
      (r: any) => { r.perspectives[0].text = 'x'.repeat(241); },
    ]) { const result = cloneResult(); change(result); expect(() => assertCouncilResult(result)).toThrow(); }
  });
  it('rejects invented rewards and impossible quality/decision pairs', () => {
    for (const change of [
      (r: any) => { r.consequences.maintenance = 'much_better'; },
      (r: any) => { r.quality = null; },
      (r: any) => { r.decision = 'revise'; },
      (r: any) => { r.grant = true; },
    ]) { const result = cloneResult(); change(result); expect(() => assertCouncilResult(result)).toThrow(); }
  });
});
