import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/direct/genlayer-*.test.ts', 'tools/genlayer*.test.ts'],
    passWithNoTests: false,
  },
});
