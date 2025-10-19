import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    crx({ manifest: manifest as any })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    rollupOptions: {
      input: {
        popup: 'src/popup/popup.html',
        options: 'src/options/options.html',
        'injected-auth-bridge': 'src/content/injected-auth-bridge.ts'
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Put injected script in assets folder with fixed name
          if (chunkInfo.name === 'injected-auth-bridge') {
            return 'assets/injected-auth-bridge.js';
          }
          return 'assets/[name]-[hash].js';
        }
      }
    }
  }
})
