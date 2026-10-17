import { describe, expect, it, vi } from 'vitest';
import { isTransientReadError, withReadRetry } from '../../src/genlayer/read-retry';

const noWait = () => Promise.resolve();

describe('public read retries', () => {
  it('retries a dropped request and returns the later answer', async () => {
    const read = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(Object.assign(new Error('HTTP request failed.'), { name: 'HttpRequestError', details: 'Failed to fetch' }))
      .mockResolvedValueOnce({ nextNonce: '0' });
    const retried: number[] = [];
    await expect(withReadRetry(read, { sleep: noWait, onRetry: n => retried.push(n) })).resolves.toEqual({ nextNonce: '0' });
    expect(read).toHaveBeenCalledTimes(3);
    expect(retried).toEqual([1, 2]);
  });

  it('gives up after the last wait and surfaces the original error', async () => {
    const read = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(withReadRetry(read, { sleep: noWait })).rejects.toThrow('Failed to fetch');
    expect(read).toHaveBeenCalledTimes(4);
  });

  it('never retries answers: contract errors, invalid evidence, missing receipts or cancellation', async () => {
    for (const error of [
      Object.assign(new Error('[EXPECTED] Unknown site'), { name: 'ContractFunctionExecutionError' }),
      Object.assign(new Error('Invalid evidence'), { code: 'INVALID_EVIDENCE' }),
      Object.assign(new Error('Transaction receipt not found'), { name: 'TransactionReceiptNotFoundError' }),
      Object.assign(new Error('Read cancelled'), { code: 'ABORTED' }),
    ]) {
      const read = vi.fn().mockRejectedValue(error);
      await expect(withReadRetry(read, { sleep: noWait })).rejects.toBe(error);
      expect(read).toHaveBeenCalledTimes(1);
    }
  });

  it('treats read timeouts and gateway errors as transient, found through wrapped causes', () => {
    expect(isTransientReadError(Object.assign(new Error('Public read timed out.'), { code: 'READ_TIMEOUT' }))).toBe(true);
    expect(isTransientReadError(new Error('outer', { cause: new Error('fetch failed: socket hang up') }))).toBe(true);
    expect(isTransientReadError(new Error('Request failed with status 503'))).toBe(true);
    expect(isTransientReadError(new Error('Nonce mismatch'))).toBe(false);
  });

  it('stops when the read is cancelled during a wait', async () => {
    const controller = new AbortController();
    const read = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const sleep = async () => { controller.abort(); };
    await expect(withReadRetry(read, { sleep, signal: controller.signal })).rejects.toThrow('Failed to fetch');
    expect(read).toHaveBeenCalledTimes(1);
  });
});
