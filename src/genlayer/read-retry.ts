// Public, idempotent reads (views, receipts, transaction status, contract source)
// can fail transiently on the RPC: a dropped request surfaces in the browser as
// "Failed to fetch". Those are retried a few times with growing waits. Anything
// that is an answer — a contract error, invalid evidence, "receipt not found yet",
// or a cancellation — is never retried. Wallet transactions never come through here.

export const READ_RETRY_DELAYS_MS: readonly number[] = Object.freeze([500, 1500, 4000]);

function messages(error: unknown): string[] {
  const out: string[] = [];
  for (let e: unknown = error, depth = 0; e && depth < 6; depth++) {
    const r = e as { name?: unknown; message?: unknown; shortMessage?: unknown; details?: unknown; code?: unknown; cause?: unknown };
    for (const v of [r.name, r.message, r.shortMessage, r.details, r.code]) if (typeof v === 'string') out.push(v);
    e = r.cause;
  }
  return out;
}

/** True only for network-level failures where asking again is safe and may succeed. */
export function isTransientReadError(error: unknown): boolean {
  const text = messages(error);
  if (text.some(t => t === 'ABORTED' || t === 'INVALID_EVIDENCE' || t === 'TransactionReceiptNotFoundError' || t === 'TransactionNotFoundError')) return false;
  if (text.some(t => t === 'READ_TIMEOUT' || t === 'HttpRequestError' || t === 'TimeoutError')) return true;
  return text.some(t => /failed to fetch|fetch failed|networkerror|network error|load failed|econnreset|etimedout|econnrefused|socket hang up|\b(429|502|503|504)\b/i.test(t));
}

export interface ReadRetryOptions {
  readonly delays?: readonly number[];
  readonly sleep?: (ms: number) => Promise<void>;
  readonly signal?: AbortSignal;
  /** Called before each retry (e.g. to tell the player the network is being retried). */
  readonly onRetry?: (attempt: number, error: unknown) => void;
}

/** Run a read, retrying transient network failures with the given waits. */
export async function withReadRetry<T>(read: () => Promise<T>, options: ReadRetryOptions = {}): Promise<T> {
  const delays = options.delays ?? READ_RETRY_DELAYS_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  for (let attempt = 0; ; attempt++) {
    try {
      return await read();
    } catch (error) {
      if (attempt >= delays.length || options.signal?.aborted || !isTransientReadError(error)) throw error;
      options.onRetry?.(attempt + 1, error);
      await sleep(delays[attempt]!);
      if (options.signal?.aborted) throw error;
    }
  }
}
