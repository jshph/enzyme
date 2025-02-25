import { resolve, join } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
// Import the plugin using a dynamic import to avoid TypeScript errors
// @ts-ignore
import { chatHmrPlugin } from './vite.hmr.plugin.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Create a function to conditionally add the HMR plugin
const getPlugins = () => {
  const plugins = [react(), nodePolyfills()];
  
  // Only add the HMR plugin in development mode
  if (process.env.NODE_ENV !== 'production') {
    try {
      // @ts-ignore - Dynamically add the plugin
      plugins.push(chatHmrPlugin());
    } catch (error) {
      console.warn('Failed to load HMR plugin:', error);
    }
  }
  
  return plugins;
};

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
    plugins: getPlugins(),
    css: {
      postcss: {
        plugins: [tailwindcss(), autoprefixer()],
      },
    },
    build: {
      rollupOptions: {
        input: {
          dashboard: resolve(__dirname, 'src/renderer/dashboard.html'),
          chat: resolve(__dirname, 'src/renderer/chat.html'),
        },
        output: {
          format: 'es',
          dir: 'out/renderer',
          entryFileNames: '[name]/index.js',
          chunkFileNames: '[name]/[hash].js',
          assetFileNames: '[name]/[hash].[ext]'
        },
        external: ['electron']
      },
      // Copy resources folder
      assetsDir: 'resources',
      copyPublicDir: true,
      outDir: 'out/renderer'
    },
    server: {
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        overlay: true,
        timeout: 30000
      },
      watch: {
        usePolling: true,
        interval: 1000,
      }
    }
  }
})
