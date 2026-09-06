import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const syncDbPath = path.resolve(__dirname, 'data_sync.json')

function rosSyncPlugin() {
  return {
    name: 'ros-local-sync',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/api/sync' || req.url?.startsWith('/api/sync?')) {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

          if (req.method === 'OPTIONS') {
            res.statusCode = 204
            res.end()
            return
          }

          if (req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json')
            try {
              if (fs.existsSync(syncDbPath)) {
                const content = fs.readFileSync(syncDbPath, 'utf8')
                res.end(content || '{}')
              } else {
                res.end('{}')
              }
            } catch (e) {
              res.end('{}')
            }
            return
          }

          if (req.method === 'POST') {
            let body = ''
            req.on('data', chunk => { body += chunk })
            req.on('end', () => {
              try {
                const incoming = JSON.parse(body || '{}')
                let existing = {}
                if (fs.existsSync(syncDbPath)) {
                  try {
                    existing = JSON.parse(fs.readFileSync(syncDbPath, 'utf8') || '{}')
                  } catch (e) {}
                }
                const merged = { ...existing, ...incoming, updatedAt: new Date().toISOString() }
                fs.writeFileSync(syncDbPath, JSON.stringify(merged, null, 2), 'utf8')
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: true, data: merged }))
              } catch (err) {
                res.statusCode = 500
                res.end(JSON.stringify({ error: err.message }))
              }
            })
            return
          }
        }
        next()
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    rosSyncPlugin()
  ],
})
