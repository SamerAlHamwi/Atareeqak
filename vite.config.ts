import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * The dashboard calls `/api/*` on its own origin and this proxy forwards it to
 * the Laravel backend, so the browser never makes a cross-origin request and
 * config/cors.php does not need to list the Vite port.
 *
 * Default target is the local backend on :8000 (`php artisan serve`). The
 * Docker stack would serve :8080, but Apache/XAMPP already owns that port on
 * this machine. There is no deployed API — see docs/api/probe-results.md.
 *
 * Override per machine with VITE_PROXY_TARGET in .env.local.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000/api'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
