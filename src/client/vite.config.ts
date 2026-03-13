import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Vite configuration for the ATO frontend
// Proxies /api requests to the backend during development
export default defineConfig({
  plugins: [react()],
  root: __dirname,
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      // Proxy all /api requests to backend during development
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // SSE needs special handling to disable buffering
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // Ensure SSE responses are not buffered
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
              proxyRes.headers['x-accel-buffering'] = 'no';
            }
          });
        },
      },
    },
  },
});
