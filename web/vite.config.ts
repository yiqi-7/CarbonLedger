import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  assetsInclude: ['**/*.xlsx'],
  build: {
    rollupOptions: {
      input: {
        platform: fileURLToPath(new URL('./index.html', import.meta.url)),
        customer: fileURLToPath(new URL('./customer.html', import.meta.url)),
      },
    },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
})
