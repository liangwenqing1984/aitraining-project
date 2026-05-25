import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 3000,
    host: true,
    // 代理配置：将 /api/* 请求转发到后端服务器
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3004',
        changeOrigin: true,
        rewrite: (path) => path
      },
      '/socket.io': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3004',
        ws: true,
        changeOrigin: true
      }
    }
  }
})
