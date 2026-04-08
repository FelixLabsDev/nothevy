// ---------------------------------------------------------------------------
// Local API server — serves GET/POST /api/db backed by public/local-db.json
// Run alongside Vite dev server; Vite proxies /api/* here.
// ---------------------------------------------------------------------------
import { createServer } from 'http'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, 'public', 'local-db.json')
const PORT = 3001

const server = createServer((req, res) => {
  // Allow requests from the Vite dev server origin
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  // GET /api/db — read and return the entire DB file
  if (req.url === '/api/db' && req.method === 'GET') {
    try {
      const data = readFileSync(DB_PATH, 'utf-8')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(data)
    } catch (err) {
      console.error('[api] Failed to read DB file:', err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Failed to read DB file' }))
    }
    return
  }

  // POST /api/db — write the request body as the new DB file
  if (req.url === '/api/db' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try {
        // Validate JSON before writing to avoid corrupting the file
        const parsed = JSON.parse(body)
        writeFileSync(DB_PATH, JSON.stringify(parsed, null, 2))
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch (err) {
        console.error('[api] Failed to write DB file:', err)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Failed to write DB file' }))
      }
    })
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

server.listen(PORT, () => console.log(`[api] DB server running on :${PORT} — file: ${DB_PATH}`))
