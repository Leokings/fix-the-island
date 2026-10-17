import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error The small Node-only deployment helper is JavaScript and is not part of the app's TS build.
import { assertBalanceMatches, balanceEvidence, DEPLOYER_ADDRESS, readDeployerBalance } from '../../tools/studionet-balance.mjs';

describe('StudioNet balance tripwire', () => {
  it('records an unchanged balance without a decrease alert', () => {
    const evidence = balanceEvidence(792000000000000000n, 792000000000000000n);
    expect(evidence).toMatchObject({
      balanceBeforeGEN: '0.792',
      balanceAfterGEN: '0.792',
      balanceDeltaGEN: '0',
      balanceDecreaseWei: '0',
      balanceGate: 'no-decrease-observed',
    });
  });

  it('records even a one-wei decrease so callers can stop the sequence', () => {
    const evidence = balanceEvidence(792000000000000000n, 791999999999999999n);
    expect(evidence.balanceDeltaWei).toBe('-1');
    expect(evidence.balanceDecreaseWei).toBe('1');
    expect(evidence.balanceGate).toBe('decrease-detected-stop');
  });

  it('rejects a balance change between the approval snapshot and broadcast', () => {
    expect(() => assertBalanceMatches('10', '9')).toThrow(/changed after the confirmation prompt/);
  });

  it('reads the intended deployer account only', async () => {
    const getBalance = vi.fn(async () => 123n);
    await expect(readDeployerBalance({ getBalance })).resolves.toBe(123n);
    expect(getBalance).toHaveBeenCalledWith({ address: DEPLOYER_ADDRESS });
  });
});
