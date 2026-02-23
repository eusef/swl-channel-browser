import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Include public assets that aren't part of the Vite build
      includeAssets: [
        'favicon.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'audio-worklet-processor.js',
      ],
      manifest: false, // We already have public/manifest.json
      workbox: {
        // Precache all Vite build outputs (JS, CSS, HTML)
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff,woff2}'],
        // Runtime caching for API calls (stale-while-revalidate)
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'swl-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
            },
          },
        ],
        // Navigation fallback for SPA
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/ws\//],
      },
      // Enable SW in dev mode so dev testing works
      devOptions: {
        enabled: true,
      },
    }),
  ],
  root: '.',
  publicDir: 'public',
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['.local'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/ws/sdr': {
        target: 'ws://127.0.0.1:3000',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
});
