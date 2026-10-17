import { describe, expect, it } from 'vitest';
import { discoverInjectedProvider } from '../../src/genlayer/injected-provider';
import type { InjectedProvider } from '../../src/genlayer/types';

function browserWithProviders(entries: ReadonlyArray<readonly [string, InjectedProvider]>): Window {
  const target = new EventTarget() as Window;
  target.addEventListener('eip6963:requestProvider', () => {
    for (const [rdns, provider] of entries) {
      target.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { info: { rdns }, provider } }));
    }
  });
  return target;
}

const provider = (): InjectedProvider => ({ request: async () => null });

describe('injected wallet discovery', () => {
  it('selects the explicitly preferred wallet when several extensions are installed', async () => {
    const rabby = provider(), metamask = provider();
    const target = browserWithProviders([['io.metamask', metamask], ['io.rabby', rabby]]);
    await expect(discoverInjectedProvider(target, 'io.rabby', 0)).resolves.toBe(rabby);
  });

  it('does not guess when multiple providers are announced and the preferred one is absent', async () => {
    const target = browserWithProviders([['io.metamask', provider()], ['com.okex.wallet', provider()]]);
    await expect(discoverInjectedProvider(target, 'io.rabby', 0)).resolves.toBeUndefined();
  });

  it('supports a single announced provider and legacy single-wallet injection', async () => {
    const onlyProvider = provider();
    await expect(discoverInjectedProvider(browserWithProviders([['io.metamask', onlyProvider]]), 'io.rabby', 0)).resolves.toBe(onlyProvider);
    const legacy = provider(), target = new EventTarget() as Window;
    Object.defineProperty(target, 'ethereum', { value: legacy });
    await expect(discoverInjectedProvider(target, 'io.rabby', 0)).resolves.toBe(legacy);
  });
});
