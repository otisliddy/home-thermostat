import { defineConfig } from 'vite';

// Separate from the unit runner: these talk to a deployed stack, so they are never part of
// `npm test`. They read amplify_outputs.json to find it.
export default defineConfig({
  test: {
    globals: true,
    include: ['test/integration/**/*.int.test.js'],
    testTimeout: 180000,
    hookTimeout: 120000,
    fileParallelism: false,
  },
});
