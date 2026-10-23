import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

/**
 * Dev-only gateway: does locally what nginx-gateway does on Render, so the app can call
 * VITE_API_URL=/api and every backend is reached through the Vite dev server.
 *   /api/crm/*, /api/stats/*, /api/promotions/*  -> that app, with the module prefix dropped
 *   /api/*, /ws                                   -> app-core
 * Targets come from .env.local (CORE_URL, CRM_URL, STATS_URL, PROMOTIONS_URL).
 * Keep these rules in sync with coffee-shop-be/nginx-gateway/templates/default.conf.template.
 */
function devGateway(env: Record<string, string>): Record<string, ProxyOptions> {
  const target = (url: string, extra: ProxyOptions = {}): ProxyOptions => ({
    target: url,
    changeOrigin: true,
    secure: false,
    // the browser only ever sees localhost:5173, so the backends' CORS / allowed-origin checks are moot
    configure: (proxy) => {
      proxy.on('proxyReq', (req) => req.removeHeader('origin'))
      proxy.on('proxyReqWs', (req) => req.removeHeader('origin'))
      // backend not running -> 502 like nginx, so ServiceGate shows "Dịch vụ … chưa sẵn sàng"
      proxy.on('error', (_err, _req, res) => {
        if ('writeHead' in res && !res.headersSent) res.writeHead(502).end()
      })
    },
    ...extra,
  })
  const module = (name: string, url: string): ProxyOptions =>
    target(url, { rewrite: (p) => p.replace(new RegExp(`^/api/${name}`), '/api') })

  const core = env.CORE_URL || 'http://localhost:8080'
  return {
    '/api/crm': module('crm', env.CRM_URL || 'http://localhost:8081'),
    '/api/stats': module('stats', env.STATS_URL || 'http://localhost:8082'),
    '/api/promotions': module('promotions', env.PROMOTIONS_URL || 'http://localhost:8083'),
    '/api': target(core),
    '/ws': target(core, { ws: true }),
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // sockjs-client expects Node's `global`
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // Visual Studio keeps its index files under .vs locked; watching them crashes the dev server
    watch: { ignored: ['**/.vs/**'] },
    proxy: devGateway(loadEnv(mode, process.cwd(), '')),
  },
}))
