import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
