import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'react-vendor'
          }
          if (id.includes('react-markdown') || id.includes('remark-gfm')) {
            return 'markdown'
          }
          if (id.includes('react-syntax-highlighter')) {
            return 'syntax-hl'
          }
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: 'electron/main/index.ts',
        vite: {
          build: {
            commonjsOptions: { ignoreDynamicRequires: true },
            rollupOptions: {
              external: [
                'sql.js', 'vectra', 'zod',
                /^@modelcontextprotocol\//,
                /^vectra\//,
                /^zod\//,
              ],
            },
          },
        },
      },
      preload: {
        input: 'electron/preload/index.ts',
      },
    }),
  ],
  clearScreen: false,
})
