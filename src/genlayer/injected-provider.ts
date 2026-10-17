import type { InjectedProvider } from './types';

interface Eip6963Info {
  readonly rdns?: string;
}

interface Eip6963Announce {
  readonly info: Eip6963Info;
  readonly provider: InjectedProvider;
}

/**
 * Prefer the wallet the player previously enabled (Rabby) when several
 * extensions inject providers. Never silently pick an arbitrary wallet.
 */
export async function discoverInjectedProvider(
  target: Window = window,
  preferredRdns = 'io.rabby',
  timeoutMs = 120,
): Promise<InjectedProvider | undefined> {
  const ethereum = (target as Window & { ethereum?: InjectedProvider }).ethereum;
  const providers = new Map<string, InjectedProvider>();
  const announce = (event: Event): void => {
    const detail = (event as CustomEvent<Eip6963Announce>).detail;
    if (detail?.info?.rdns && typeof detail.provider?.request === 'function') {
      providers.set(detail.info.rdns, detail.provider);
    }
  };

  target.addEventListener('eip6963:announceProvider', announce);
  target.dispatchEvent(new Event('eip6963:requestProvider'));
  await new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  target.removeEventListener('eip6963:announceProvider', announce);

  const preferred = providers.get(preferredRdns);
  if (preferred) return preferred;
  if (providers.size === 1) return providers.values().next().value;
  // Legacy single-wallet browsers remain supported, but an ambiguous global
  // provider is not used when EIP-6963 explicitly reported multiple wallets.
  return providers.size === 0 ? ethereum : undefined;
}
