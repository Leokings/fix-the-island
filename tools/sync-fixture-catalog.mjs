// Generated-data sync: the TypeScript client consumes the exact JSON fixture.
import { readFile, writeFile } from 'node:fs/promises';

const fixturePath = new URL('../contracts/island_fixtures.json', import.meta.url);
const catalogPath = new URL('../src/genlayer/catalog.ts', import.meta.url);
const fixtures = JSON.parse(await readFile(fixturePath, 'utf8'));
let source = await readFile(catalogPath, 'utf8');
const start = source.indexOf('export const FIXTURE_VERSION =');
const endMarker = '\n]);';
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error('Catalog generated-data boundaries not found.');
source = source.slice(0, start) + `export const FIXTURE_VERSION = '${fixtures[0].version}';\nexport const REPAIR_SCENARIOS: readonly IslandSiteFixture[] = freeze(${JSON.stringify(fixtures, null, 2)});` + source.slice(end + endMarker.length);
await writeFile(catalogPath, source, 'utf8');
