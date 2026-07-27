import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // react-draggable (pulled in by react-resizable, which powers the resizable quotes grid) ships
  // a CommonJS build containing `if (process.env.DRAGGABLE_DEBUG) …`. `process` does not exist in
  // the browser, so that line threw ReferenceError on every drag START — the column resize simply
  // never began, silently, with nothing in the console until the handler was called directly.
  // Replacing the exact expression at build time means `process` is never referenced at runtime.
  define: {
    'process.env.DRAGGABLE_DEBUG': 'false',
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/storage': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
