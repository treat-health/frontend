import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const workspaceRoot = path.resolve(__dirname, '..')
const certPath = path.resolve(workspaceRoot, 'localhost+3.pem')
const keyPath = path.resolve(workspaceRoot, 'localhost+3-key.pem')

const hasLocalHttpsCertificates = fs.existsSync(certPath) && fs.existsSync(keyPath)
const httpsConfig = hasLocalHttpsCertificates
  ? {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    }
  : undefined

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Expose the dev server to devices on the same LAN
    allowedHosts: true, // Allows all hosts (e.g. ngrok) to access the dev server
    https: httpsConfig,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Proxy socket.io if it's used
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
    }
  },
})
