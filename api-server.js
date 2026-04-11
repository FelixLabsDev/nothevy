// ---------------------------------------------------------------------------
// Local API server — serves GET/POST /api/db backed by public/local-db.json
// and GET/POST/DELETE /api/media backed by public/media/ files on disk.
// Run alongside Vite dev server; Vite proxies /api/* here.
// ---------------------------------------------------------------------------
import { createServer } from 'http'
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import { randomUUID } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, 'public', 'local-db.json')
const MEDIA_DIR = join(__dirname, 'public', 'media')
const PORT = 3001

// Ensure media directory exists on startup
if (!existsSync(MEDIA_DIR)) mkdirSync(MEDIA_DIR, { recursive: true })

const server = createServer((req, res) => {
  // Allow requests from the Vite dev server origin
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  // POST /api/media — save a media file to public/media/, returns { url }
  // Expects ?name=filename.ext query param and raw binary body
  if (req.url?.startsWith('/api/media') && req.method === 'POST') {
    const urlObj = new URL(req.url, `http://localhost:${PORT}`)
    const originalName = urlObj.searchParams.get('name') || 'file.bin'
    const ext = originalName.split('.').pop()?.toLowerCase() || 'bin'
    const filename = `${randomUUID()}.${ext}`
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      try {
        writeFileSync(join(MEDIA_DIR, filename), Buffer.concat(chunks))
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ url: `/media/${filename}` }))
      } catch (err) {
        console.error('[api] Failed to write media file:', err)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Failed to save media file' }))
      }
    })
    return
  }

  // DELETE /api/media/:filename — remove a media file from disk
  if (req.url?.startsWith('/api/media/') && req.method === 'DELETE') {
    const filename = req.url.slice('/api/media/'.length).split('?')[0]
    try { unlinkSync(join(MEDIA_DIR, filename)) } catch { /* file may not exist */ }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }

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
