import type { Address, IslandSiteId } from './types';
import publicAddresses from './deployments.json';
import studioAddresses from './deployments.studionet.json';

// Existing Bradbury addresses are retained for explicit legacy-network use.
// The game defaults to the separate Studionet map below, and the adapter checks
// each configured address against this working tree's pinned source metadata.
// Addresses and transaction hashes are public; no signing material is stored.
export const DEPLOYED_SITE_ADDRESSES = publicAddresses as Readonly<Record<IslandSiteId, Address>> | null;
const STUDIO_SITE_IDS: readonly IslandSiteId[] = ['pier_hoist','village_pump','tidal_sluice','creek_bridge','coast_windmill','woodland_pathlight','upland_waterworks','ridge_beacon'];
const studioMap = studioAddresses as Partial<Record<IslandSiteId, Address>>;
export const STUDIONET_SITE_ADDRESSES: Readonly<Record<IslandSiteId, Address>> | null =
  STUDIO_SITE_IDS.every((site) => typeof studioMap[site] === 'string') ? studioMap as Readonly<Record<IslandSiteId, Address>> : null;
