import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig({
  plugins: [vue(), vueDevTools()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (id.includes('three')) {
            return 'vendor-three'
          }

          if (id.includes('chart.js') || id.includes('vue-chartjs')) {
            return 'vendor-charts'
          }

          if (
            id.includes('vue') ||
            id.includes('pinia') ||
            id.includes('vue-router') ||
            id.includes('vue-i18n')
          ) {
            return 'vendor-vue'
          }

          return 'vendor-misc'
        },
      },
    },
  },
})
