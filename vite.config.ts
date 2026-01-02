
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import type { IncomingMessage, ServerResponse } from 'http'
import type { Socket } from 'net'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  server: {
    host: true, // Listen on all addresses (0.0.0.0) to allow LAN access
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001', 
        changeOrigin: true,
        secure: false,
        timeout: 500000, // Increased to 5 minutes to prevent timeout on slow AI response
        proxyTimeout: 500000,
        configure: (proxy, _options) => {
          proxy.on('error', (err: Error, _req: IncomingMessage, res: ServerResponse | Socket) => {
             console.log('Backend not ready yet. Retrying...');
             // Check if res is a ServerResponse (has writeHead) before attempting to send a response
             if ('writeHead' in res && !res.headersSent) {
                res.writeHead(503, {
                  'Content-Type': 'application/json',
                });
                res.end(JSON.stringify({ error: 'Backend is starting up...' }));
             }
          });
        }
      }
    }
  }
})
