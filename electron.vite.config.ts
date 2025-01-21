import { resolve, join } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), nodePolyfills()],
    build: {
      rollupOptions: {
        output: {
          format: 'es'
        },
        external: ['electron']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin(), nodePolyfills()],
    build: {
      rollupOptions: {
        output: {
          format: 'es'
        },
        external: ['electron']
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src/renderer/dashboard'),
        '@renderer': path.resolve(__dirname, './src/renderer'),
        '@main': path.resolve(__dirname, './src/main')
      }
    },
    plugins: [react(), nodePolyfills()],
    css: {
      postcss: {
        plugins: [tailwindcss(), autoprefixer()],
      },
    },
    build: {
      rollupOptions: {
        input: {
          dashboard: resolve(__dirname, 'src/renderer/dashboard.html'),
        },
        output: {
          format: 'es'
        },
        external: ['electron']
      },
      // Copy resources folder
      assetsDir: 'resources',
      copyPublicDir: true
    },
    server: {
      hmr: {
        protocol: 'ws',
        host: 'localhost'
      }
    }
  }
})
