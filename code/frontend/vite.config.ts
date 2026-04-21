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
        target: 'http://localhost:3004',  // 后端服务地址（端口3004）
        changeOrigin: true,
        rewrite: (path) => path  // 保持路径不变
      }
    }
  }
})
