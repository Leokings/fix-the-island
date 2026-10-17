import type { Address, Hash } from './types';

export interface ExpeditionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function expeditionStorageKey(chainId: number, contractAddress: Address, caller: Address, fixtureVersion: string): string {
  return `fix-island:active-expedition:${chainId}:${contractAddress.toLowerCase()}:${caller.toLowerCase()}:${fixtureVersion}`;
}

export function createExpeditionId(): Hash {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

/** Reuse the active run on reconnect; rotate only when the player explicitly starts a new expedition. */
export function activeExpeditionId(storage: ExpeditionStorage, key: string): Hash {
  const existing = storage.getItem(key);
  if (existing && /^0x[0-9a-f]{64}$/.test(existing)) return existing as Hash;
  const next = createExpeditionId();
  storage.setItem(key, next);
  return next;
}

export function rotateExpeditionId(storage: ExpeditionStorage, key: string): Hash {
  const current=storage.getItem(key);
  if(current&&/^0x[0-9a-f]{64}$/.test(current))storage.setItem(`${key}:previous`,current);
  const next = createExpeditionId();
  storage.setItem(key, next);
  return next;
}

export function previousExpeditionId(storage: ExpeditionStorage, key: string): Hash | null {
  const value=storage.getItem(`${key}:previous`);
  return value&&/^0x[0-9a-f]{64}$/.test(value)?value as Hash:null;
}
