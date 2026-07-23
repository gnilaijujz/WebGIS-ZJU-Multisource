import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cesium()],
  server: {
    port: 5173,
    proxy: {
      // Large read-only data (3D Tiles / COG) is served by data-server on :8686.
      // Proxying keeps the frontend on one origin and avoids CORS in dev.
      '/data-server': {
        target: 'http://localhost:8686',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/data-server/, ''),
      },
    },
  },
})
