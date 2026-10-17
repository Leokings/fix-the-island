import { normalizeAddress } from './schema';
import type { Address, GenLayerConfig, IslandSiteId } from './types';
import { REPAIR_SCENARIOS } from './catalog';

export function resolveGenLayerConfig<T extends { VITE_GENLAYER_SITE_ADDRESSES?: string; VITE_GENLAYER_NETWORK?: string }>(env: T): GenLayerConfig {
  const selected = env.VITE_GENLAYER_NETWORK?.trim() || 'testnetBradbury';
  const network = selected === 'testnetBradbury' ? 'testnetBradbury' : selected === 'studionet' ? 'studionet' : null;
  if (!network) return Object.freeze({ enabled: false, reason: 'invalid-address' });
  const chainId = network === 'studionet' ? 61999 : 4221;
  const rpcUrl = network === 'studionet' ? 'https://studio.genlayer.com/api' : 'https://rpc-bradbury.genlayer.com';
  const sites = env.VITE_GENLAYER_SITE_ADDRESSES?.trim();
  if (!sites) return Object.freeze({ enabled: false, reason: 'unconfigured' });
  try {
    const raw: unknown = JSON.parse(sites);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).length !== REPAIR_SCENARIOS.length) throw new Error('Expected every site address');
    const values = raw as Record<string, string>;
    const siteAddresses = Object.freeze(Object.fromEntries(REPAIR_SCENARIOS.map(site => [site.id, normalizeAddress(values[site.id]!)])) as Record<IslandSiteId, Address>);
    if (new Set(Object.values(siteAddresses)).size !== REPAIR_SCENARIOS.length) throw new Error('Site addresses must be distinct');
    return Object.freeze({ enabled: true, contractAddress: siteAddresses.pier_hoist!, siteAddresses,
      network, chainId, rpcUrl });
  } catch { return Object.freeze({ enabled: false, reason: 'invalid-address' }); }
}

/** The root address is only a session namespace, never a substituted recipient. */
export function siteContractAddress(config: { contractAddress: `0x${string}`; siteAddresses?: Readonly<Record<string, `0x${string}`>> }, siteId: string): `0x${string}` {
  if (!config.siteAddresses) throw new GenLayerClientError('INVALID_EVIDENCE', 'Per-site contract addresses are required.');
  const address = config.siteAddresses[siteId];
  if (!address) throw new GenLayerClientError('INVALID_EVIDENCE', 'Unconfigured repair site.');
  return address;
}

export class GenLayerUnavailableError extends Error {
  readonly code = 'GENLAYER_DISABLED';
  constructor(readonly reason: string) {
    super(`Connected repair validation is disabled: ${reason}.`);
    this.name = 'GenLayerUnavailableError';
  }
}

export class GenLayerClientError extends Error {
  constructor(readonly code: 'INVALID_EVIDENCE' | 'EVM_REVERTED' | 'DISCONNECTED' | 'WRONG_NETWORK' | 'BUSY' | 'READ_TIMEOUT' | 'ABORTED' | 'RUNTIME_UNAVAILABLE', message: string) {
    super(message); this.name = 'GenLayerClientError';
  }
}
