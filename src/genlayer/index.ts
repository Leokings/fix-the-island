export type * from './types';
export { REPAIR_LIMITS, RepairValidationError, createRepairArtifact, validateRepairArtifact, parseRepairArtifact,
  normalizeRationale, normalizeAddress, normalizeNonce } from './schema';
export type { ArtifactValidation, ValidationIssue } from './schema';
export { REPAIR_DIGEST_DOMAIN, canonicalizeRepairArtifact, canonicalizeRepairSubmission, digestRepairSubmission } from './canonical';

export { FIXTURE_VERSION, REPAIR_SCENARIOS, getRepairScenario } from './catalog';
export { createInitialArtifact, validateRepairLocally, getSlotOptions, updateRepairPart, placeRepairPart, removeRepairPart,
  updateRepairConfiguration, connectRepairPorts, disconnectRepairPorts } from './advisory';
export { createRepairExampleDraft } from './examples';
export { activeExpeditionId, createExpeditionId, expeditionStorageKey, previousExpeditionId, rotateExpeditionId } from './expedition';

export { resolveGenLayerConfig, siteContractAddress, GenLayerUnavailableError, GenLayerClientError } from './config';
export { createGenLayerAdapter } from './adapter';
export type { GenLayerAdapterOptions, RepairReadClient, RepairWriteClient } from './adapter';
