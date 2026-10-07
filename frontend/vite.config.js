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

            if (id.includes('jspdf')) {
              return 'pdf'
            }

            /*
             * The heavy libraries the app deliberately loads on demand.
             *
             * manualChunks wins over how a module was imported, so the
             * catch-all below was pulling these into `vendor` and undoing the
             * dynamic import() at each call site - OCR and the PDF reader are
             * only ever reached from the document-scan path, and the charts
             * only from one admin screen, but every visitor downloaded all
             * three before the first paint. Naming them keeps them in their
             * own files, fetched when that code actually runs.
             */
            if (id.includes('tesseract.js')) {
              return 'ocr'
            }

            if (id.includes('pdfjs-dist')) {
              return 'pdf-reader'
            }

            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) {
              return 'charts'
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
