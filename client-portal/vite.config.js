import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Runs on a different port than frontend/ (5173) — a genuinely separate app,
// deployable to its own subdomain in production (e.g. portal.<domain>).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devApiTarget = env.VITE_DEV_API_TARGET || 'http://127.0.0.1:8082'

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5174,
      strictPort: true,
      proxy: {
        '/api': {
          target: devApiTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      target: 'es2020',
      cssCodeSplit: true,
    },
  }
})
