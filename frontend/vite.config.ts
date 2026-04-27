/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const devProxyTarget = env.DEV_API_PROXY_TARGET
  if (mode === 'development' && (devProxyTarget == null || devProxyTarget === '')) {
    throw new Error(
      'Missing DEV_API_PROXY_TARGET. Add it to frontend/.env.development (see frontend/.env.example).',
    )
  }

  return {
    plugins: [react(), tailwindcss()],
    // Dev: browser calls same origin `/api/...` so requests hit Vite, which forwards to the Go server.
    server: {
      proxy:
        mode === 'development' && devProxyTarget
          ? {
              '/api': {
                target: devProxyTarget,
                changeOrigin: true,
              },
            }
          : undefined,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
    },
  }
})
