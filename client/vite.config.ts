import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const env = loadEnv('all', process.cwd())

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api': {
                target: env.VITE_API_URL || 'http://localhost:8080',
                changeOrigin: true
            }
        }
    },
    preview: {
        port: 80,
        strictPort: true
    }
})
