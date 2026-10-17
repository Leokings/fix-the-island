import type {
  Address, Nonce, QuarterTurn, RepairArtifact, RepairCatalog, RepairChannel,
  RepairConnection, RepairEndpoint, RepairPart,
} from './types';

export const REPAIR_LIMITS = Object.freeze({
  artifactBytes: 8192, parts: 24, connections: 48, identifierLength: 40,
  rationaleMinScalars: 15, rationaleMaxScalars: 200, rationaleBytes: 2048,
});

export interface ValidationIssue {
  readonly path: string;
  readonly code: 'shape' | 'identifier' | 'bounds' | 'duplicate' | 'reference' | 'catalog' | 'json';
  readonly message: string;
}

export type ArtifactValidation =
  | Readonly<{ valid: true; artifact: RepairArtifact }>
  | Readonly<{ valid: false; issues: readonly ValidationIssue[] }>;

export class RepairValidationError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
    this.name = 'RepairValidationError';
    this.issues = Object.freeze(issues.map((issue) => Object.freeze({ ...issue })));
  }
}

const encoder = new TextEncoder();
const channels: readonly string[] = ['mechanical', 'electrical', 'water'];

function issue(issues: ValidationIssue[], path: string, code: ValidationIssue['code'], message: string): void {
  issues.push(Object.freeze({ path, code, message }));
}

function record(value: unknown, keys: readonly string[], path: string, issues: ValidationIssue[]): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value) as object | null)) {
    issue(issues, path, 'shape', 'Expected a plain object.');
    return null;
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actualKeys = Reflect.ownKeys(descriptors);
  if (actualKeys.length !== keys.length || actualKeys.some((key) => typeof key !== 'string' || !keys.includes(key)) ||
      keys.some((key) => !descriptors[key] || !('value' in descriptors[key]))) {
    issue(issues, path, 'shape', 'Fields must match the schema exactly and contain data values.');
    return null;
  }
  return Object.fromEntries(keys.map((key) => [key, descriptors[key]!.value as unknown]));
}

function identifier(value: unknown, path: string, issues: ValidationIssue[]): value is string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 40 || /[^a-z0-9_-]/.test(value)) {
    issue(issues, path, 'identifier', 'Use 1–40 lowercase letters, digits, underscores or hyphens.');
    return false;
  }
  return true;
}

function part(value: unknown, path: string, issues: ValidationIssue[]): RepairPart | null {
  const start = issues.length;
  const data = record(value, ['id', 'optionId', 'slotId', 'orientationQuarterTurns', 'settingId'], path, issues);
  if (!data) return null;
  for (const key of ['id', 'optionId', 'slotId', 'settingId']) identifier(data[key], `${path}.${key}`, issues);
  const orientation = data.orientationQuarterTurns;
  if (typeof orientation !== 'number' || !Number.isInteger(orientation) || Object.is(orientation, -0) || orientation < 0 || orientation > 3) {
    issue(issues, `${path}.orientationQuarterTurns`, 'bounds', 'Expected an integer from 0 to 3.');
  }
  if (issues.length !== start) return null;
  return Object.freeze({
    id: data.id as string, optionId: data.optionId as string, slotId: data.slotId as string,
    orientationQuarterTurns: orientation as QuarterTurn, settingId: data.settingId as string,
  });
}

function endpoint(value: unknown, path: string, issues: ValidationIssue[]): RepairEndpoint | null {
  const start = issues.length;
  const data = record(value, ['partId', 'portId'], path, issues);
  if (!data) return null;
  identifier(data.partId, `${path}.partId`, issues);
  identifier(data.portId, `${path}.portId`, issues);
  return issues.length === start ? Object.freeze({ partId: data.partId as string, portId: data.portId as string }) : null;
}

function connection(value: unknown, path: string, issues: ValidationIssue[]): RepairConnection | null {
  const data = record(value, ['channel', 'from', 'to'], path, issues);
  if (!data) return null;
  const from = endpoint(data.from, `${path}.from`, issues);
  const to = endpoint(data.to, `${path}.to`, issues);
  const channel = data.channel;
  if (typeof channel !== 'string' || !channels.includes(channel)) {
    issue(issues, `${path}.channel`, 'shape', 'Unsupported connection channel.');
    return null;
  }
  return from && to ? Object.freeze({ channel: channel as RepairChannel, from, to }) : null;
}

function checkCatalog(artifact: RepairArtifact, catalog: RepairCatalog, issues: ValidationIssue[]): void {
  const options = new Map(catalog.options.map((option) => [option.id, option]));
  const byId = new Map(artifact.parts.map((item) => [item.id, item]));
  for (const [index, item] of artifact.parts.entries()) {
    const option = options.get(item.optionId);
    if (!options.has(item.optionId)) issue(issues, `parts[${index}].optionId`, 'catalog', 'Option is not in the site catalog.');
    if (!catalog.slotIds.includes(item.slotId)) issue(issues, `parts[${index}].slotId`, 'catalog', 'Slot is not in the site catalog.');
    if (!catalog.configurationOptions.settingIds.includes(item.settingId)) issue(issues, `parts[${index}].settingId`, 'catalog', 'Setting is not in the site catalog.');
    if (option?.allowedSlots && !option.allowedSlots.includes(item.slotId)) issue(issues, `parts[${index}].slotId`, 'catalog', 'This option cannot occupy that slot.');
    if (option?.allowedSettings && !option.allowedSettings.includes(item.settingId)) issue(issues, `parts[${index}].settingId`, 'catalog', 'This option does not support that setting.');
  }
  const config = artifact.configuration;
  for (const [key, allowed] of [
    ['mountZoneId', catalog.configurationOptions.mountZoneIds],
    ['outputModeId', catalog.configurationOptions.outputModeIds],
    ['routeId', catalog.configurationOptions.routeIds],
  ] as const) {
    if (!allowed.includes(config[key])) issue(issues, `configuration.${key}`, 'catalog', 'Configuration choice is not in the site catalog.');
  }
  for (const [index, edge] of artifact.connections.entries()) {
    for (const direction of ['from', 'to'] as const) {
      const end = edge[direction];
      const item = byId.get(end.partId);
      const port = item && options.get(item.optionId)?.ports.find((candidate) => candidate.id === end.portId);
      const requiredDirection = direction === 'from' ? 'out' : 'in';
      if (!port || port.channel !== edge.channel || (port.direction !== 'bidirectional' && port.direction !== requiredDirection)) {
        issue(issues, `connections[${index}].${direction}`, 'catalog', 'Port, channel or direction does not match the site catalog.');
      }
    }
  }
}

/** Structural/catalog feedback only. A valid result is never a technical or chain approval. */
export function validateRepairArtifact(input: unknown, catalog?: RepairCatalog): ArtifactValidation {
  const issues: ValidationIssue[] = [];
  const root = record(input, ['schemaVersion', 'parts', 'configuration', 'connections'], 'artifact', issues);
  if (!root) return Object.freeze({ valid: false, issues: Object.freeze(issues) });
  if (root.schemaVersion !== 'repair-v1') issue(issues, 'schemaVersion', 'shape', 'Unsupported artifact schema version.');
  const config = record(root.configuration, ['mountZoneId', 'outputModeId', 'routeId'], 'configuration', issues);
  if (config) for (const key of ['mountZoneId', 'outputModeId', 'routeId']) identifier(config[key], `configuration.${key}`, issues);
  if (!Array.isArray(root.parts) || root.parts.length > REPAIR_LIMITS.parts) issue(issues, 'parts', 'bounds', 'Expected at most 24 parts.');
  if (!Array.isArray(root.connections) || root.connections.length > REPAIR_LIMITS.connections) issue(issues, 'connections', 'bounds', 'Expected at most 48 connections.');
  if (issues.length) return Object.freeze({ valid: false, issues: Object.freeze(issues) });
  const parts = Array.from(root.parts as unknown[], (item, index) => part(item, `parts[${index}]`, issues)).filter((item) => item !== null);
  const connections = Array.from(root.connections as unknown[], (item, index) => connection(item, `connections[${index}]`, issues)).filter((item) => item !== null);
  const ids = new Set<string>();
  const slots = new Set<string>();
  for (const [index, item] of parts.entries()) {
    if (ids.has(item.id)) issue(issues, `parts[${index}].id`, 'duplicate', 'Part ID is duplicated.');
    if (slots.has(item.slotId)) issue(issues, `parts[${index}].slotId`, 'duplicate', 'Slot is occupied more than once.');
    ids.add(item.id);
    slots.add(item.slotId);
  }
  const edges = new Set<string>();
  for (const [index, edge] of connections.entries()) {
    if (!ids.has(edge.from.partId) || !ids.has(edge.to.partId)) issue(issues, `connections[${index}]`, 'reference', 'Connection references a missing part.');
    const key = [edge.channel, edge.from.partId, edge.from.portId, edge.to.partId, edge.to.portId].join(':');
    if (edges.has(key)) issue(issues, `connections[${index}]`, 'duplicate', 'Connection is duplicated.');
    edges.add(key);
    if (edge.from.partId === edge.to.partId && edge.from.portId === edge.to.portId) issue(issues, `connections[${index}]`, 'reference', 'A port cannot connect to itself.');
  }
  const artifact: RepairArtifact = Object.freeze({
    schemaVersion: 'repair-v1', parts: Object.freeze(parts), connections: Object.freeze(connections),
    configuration: Object.freeze({ mountZoneId: config!.mountZoneId as string, outputModeId: config!.outputModeId as string, routeId: config!.routeId as string }),
  });
  if (encoder.encode(JSON.stringify(artifact)).byteLength > REPAIR_LIMITS.artifactBytes) issue(issues, 'artifact', 'bounds', 'Artifact exceeds 8 KiB.');
  if (catalog) checkCatalog(artifact, catalog, issues);
  return issues.length ? Object.freeze({ valid: false, issues: Object.freeze(issues) }) : Object.freeze({ valid: true, artifact });
}

/** Copies and freezes every artifact field without freezing the caller's mutable draft. */
export function createRepairArtifact(input: RepairArtifact, catalog?: RepairCatalog): RepairArtifact {
  const result = validateRepairArtifact(input, catalog);
  if (!result.valid) throw new RepairValidationError(result.issues);
  return result.artifact;
}

/** The token pass preserves duplicate-key and integer evidence that JSON.parse discards. */
export function parseRepairArtifact(json: string, catalog?: RepairCatalog): RepairArtifact {
  const fail = (message: string, code: ValidationIssue['code'] = 'json'): never => {
    throw new RepairValidationError([{ path: 'artifact', code, message }]);
  };
  if (typeof json !== 'string' || encoder.encode(json).byteLength > REPAIR_LIMITS.artifactBytes) fail('Artifact JSON exceeds 8 KiB or is not text.', 'bounds');
  const stack: { object: boolean; expectingKey: boolean; keys: Set<string> }[] = [];
  const tokens = /"(?:\\.|[^"\\])*"|[{}\[\]:,]|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g;
  try {
    for (const match of json.matchAll(tokens)) {
      const token = match[0];
      const context = stack.at(-1);
      if (token === '{' || token === '[') {
        stack.push({ object: token === '{', expectingKey: token === '{', keys: new Set() });
        if (stack.length > 8) fail('Artifact nesting exceeds the schema.', 'bounds');
      } else if (token === '}' || token === ']') stack.pop();
      else if (token === ',' && context?.object) context.expectingKey = true;
      else if (token.startsWith('"') && context?.object && context.expectingKey) {
        const key = JSON.parse(token) as string;
        if (context.keys.has(key)) fail('JSON object contains a duplicate key.', 'duplicate');
        context.keys.add(key);
        context.expectingKey = false;
      } else if (/^-?\d/.test(token) && (!/^(0|[1-9]\d*)$/.test(token))) fail('Only unsigned integer number tokens are supported.');
    }
    const result = validateRepairArtifact(JSON.parse(json) as unknown, catalog);
    if (!result.valid) throw new RepairValidationError(result.issues);
    return result.artifact;
  } catch (error) {
    if (error instanceof RepairValidationError) throw error;
    return fail('Malformed artifact JSON.');
  }
}

export function normalizeRationale(value: string): string {
  const normalized = typeof value === 'string' ? value.replace(/\r\n/g, '\n') : '';
  const scalars = Array.from(normalized);
  if (/[\r\n\u2028\u2029]/.test(normalized) || scalars.length < REPAIR_LIMITS.rationaleMinScalars || scalars.length > REPAIR_LIMITS.rationaleMaxScalars ||
      encoder.encode(normalized).byteLength > REPAIR_LIMITS.rationaleBytes ||
      scalars.some((scalar) => scalar.length === 1 && /[\uD800-\uDFFF]/.test(scalar))) {
    throw new RepairValidationError([{ path: 'rationale', code: 'bounds', message: 'Use one line of 15–200 Unicode scalar values, with no unpaired surrogates.' }]);
  }
  return normalized;
}

export function normalizeAddress(value: string): Address {
  if (typeof value !== 'string' || value.length !== 42 || !/^0x[\da-fA-F]{40}$/.test(value) || /^0x0{40}$/.test(value)) {
    throw new RepairValidationError([{ path: 'address', code: 'shape', message: 'Expected a nonzero 20-byte hexadecimal address.' }]);
  }
  return value.toLowerCase() as Address;
}

export function normalizeNonce(value: string): Nonce {
  if (typeof value !== 'string' || value.trim() !== value || !/^(0|[1-9]\d{0,77})$/.test(value) || BigInt(value) >= (1n << 256n)) {
    throw new RepairValidationError([{ path: 'nonce', code: 'bounds', message: 'Expected a canonical unsigned decimal uint256.' }]);
  }
  return value;
}
