// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto', // Auto-inject service worker registration for install prompt
      manifest: {
        name: 'Vestika Portfolio Manager',
        short_name: 'Vestika',
        description: 'AI-powered portfolio management and analysis',
        theme_color: '#1F2937', // gray-800
        background_color: '#111827', // gray-900
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Minimal service worker - only caches essential app shell
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        // Don't cache large images or user data
        globIgnores: ['**/v-*.png'],
        // Increase size limit to handle large bundle
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        runtimeCaching: [
          {
            // Network-first strategy for API calls (always try network first)
            urlPattern: /^https:\/\/.*\.vestika\.io\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 5 * 60 // 5 minutes
              },
              networkTimeoutSeconds: 10
            }
          }
        ]
      },
      devOptions: {
        enabled: true // Enable PWA in dev mode for testing
      }
    })
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor code into separate chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'chart-vendor': ['recharts', 'highcharts', 'highcharts-react-official'],
        }
      }
    },
    chunkSizeWarningLimit: 1500, // Increase warning limit to 1500 KB
  },
  server: {
    port: 5173,
    strictPort: true,
  }
})