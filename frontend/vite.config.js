import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('react-dom') || id.includes('react-router-dom') || id.includes('react')) {
            return 'react-core'
          }

          if (id.includes('leaflet') || id.includes('react-leaflet')) {
            return 'maps'
          }

          if (id.includes('socket.io-client')) {
            return 'realtime'
          }

          if (id.includes('framer-motion')) {
            return 'motion'
          }

          return 'vendor'
        },
      },
    },
  },
})
