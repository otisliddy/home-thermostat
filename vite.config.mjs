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
    include: ['src/**/*.test.{js,jsx}'],
  },
});
