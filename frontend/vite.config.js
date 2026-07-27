import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devApiTarget = env.VITE_DEV_API_TARGET || 'http://127.0.0.1:8082'
  const devPort = Number.parseInt(env.VITE_DEV_PORT || '', 10) || 5173
  const isE2E = mode === 'e2e'

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: devPort,
      strictPort: true,
      proxy: isE2E ? undefined : {
        '/api': {
          target: devApiTarget,
          changeOrigin: true,
        },
        '/socket.io': {
          target: devApiTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    build: {
      target: 'es2020',
      cssCodeSplit: true,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return

            if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
              return 'react-core'
            }

            if (id.includes('leaflet') || id.includes('react-leaflet')) {
              return 'maps'
            }

            if (id.includes('xlsx')) {
              return 'spreadsheet'
            }

            if (id.includes('jspdf')) {
              return 'pdf'
            }

            if (id.includes('socket.io-client')) {
              return 'realtime'
            }

            if (id.includes('framer-motion')) {
              return 'motion'
            }

            if (id.includes('lucide-react')) {
              return 'icons'
            }

            if (id.includes('axios')) {
              return 'http'
            }

            return 'vendor'
          },
        },
      },
    },
  }
})
