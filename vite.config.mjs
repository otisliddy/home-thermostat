import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // home-thermostat-common is CommonJS and is linked rather than installed, so Vite leaves it
    // out of dependency pre-bundling by default and its named exports fail to resolve in dev.
    include: ['home-thermostat-common'],
  },
  build: {
    // Amplify's project-config.json points its DistributionDir at 'build'
    outDir: 'build',
  },
  server: {
    port: 3000,
    open: true,
  },
  test: {
    globals: true,
    // One runner for the whole repo. The lambda and shared-library suites are CommonJS and use
    // chai; vitest runs them as-is, so they did not have to be rewritten to be brought in here.
    include: [
      'src/**/*.test.{js,jsx}',
      'home-thermostat-common/test/**/*.test.js',
      'amplify/function/**/*.test.js',
    ],
  },
});
