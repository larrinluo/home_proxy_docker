import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:3000',
          changeOrigin: true
          // 不rewrite，保留/api前缀，因为后端路由都是/api/v1/...
        },
        '/proxy.pac': {
          target: env.VITE_API_BASE_URL || 'http://localhost:3000',
          changeOrigin: true
          // /proxy.pac 在根路径，不在 /api 下
        }
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: true
    }
  }
})


