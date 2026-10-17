// Copy player-facing labels into the contract fixture as inert prompt data.
// The generated contracts do not import or execute UI code.
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const fixturePath = new URL('../contracts/island_fixtures.json', import.meta.url);
const fixtures = JSON.parse(await readFile(fixturePath, 'utf8'));
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const copy = await server.ssrLoadModule('/src/ui/player-copy.ts');
  for (const site of fixtures) {
    const keys = ['mountZoneIds', 'outputModeIds', 'routeIds'];
    const configurationIds = [...new Set(keys.flatMap((key) => site.configurationOptions[key]))];
    site.labels = {
      options: Object.fromEntries(site.options.map((option) => [option.id, copy.partLabel(site.id, option.id)])),
      settings: Object.fromEntries(site.configurationOptions.settingIds.map((id) => [id, copy.configLabel(id)])),
      configuration: Object.fromEntries(configurationIds.map((id) => [id, copy.configLabel(id)])),
    };
  }
  await writeFile(fixturePath, `${JSON.stringify(fixtures, null, 2)}\n`, 'utf8');
} finally {
  await server.close();
}
