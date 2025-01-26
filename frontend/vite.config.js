import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  
  // Build configuration
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
  
  // Server and proxy configuration
  server: {
    proxy: {
      // // Geoserver proxy
      // '/geoserver': {
      //   target: 'http://localhost:8080',
      //   changeOrigin: true,
      //   secure: false,
      // },
      // // Django backend proxy
      // '/api': {
      //   target: 'http://localhost:8000',
      //   changeOrigin: true,
      //   secure: false,
      // },
      // '/admin': {
      //   target: 'http://localhost:8000',
      //   changeOrigin: true,
      //   secure: false,
      // }
    }
  },
  
  // Base public path when served in production
  base: '/',
})