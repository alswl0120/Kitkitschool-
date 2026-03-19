import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const assetsDir = path.join(__dirname, 'assets')

// Dev-only plugin: serve the local `assets/` folder at /assets/
// In production (Docker), VITE_ASSET_BASE points to S3 so this is unused.
const serveLocalAssets = {
  name: 'serve-local-assets',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use('/assets', (req, res, next) => {
      const reqPath = (req.url ?? '/').split('?')[0]
      const filePath = path.join(assetsDir, reqPath)
      try {
        const stat = fs.statSync(filePath)
        if (!stat.isFile()) { next(); return }
        const ext = path.extname(filePath).toLowerCase()
        const mime: Record<string, string> = {
          '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
          '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
          '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg',
          '.mp4': 'video/mp4', '.webm': 'video/webm',
          '.txt': 'text/plain;charset=utf-8',
          '.csv': 'text/csv;charset=utf-8',
          '.json': 'application/json',
        }
        res.setHeader('Content-Type', mime[ext] ?? 'application/octet-stream')
        res.setHeader('Content-Length', stat.size)
        res.setHeader('Cache-Control', 'public, max-age=3600')
        fs.createReadStream(filePath).pipe(res)
      } catch {
        next() // not found locally → let Vite return 404 (or forward to S3 in prod)
      }
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serveLocalAssets],
  server: {
    allowedHosts: ['.ngrok-free.app'],
    port: parseInt(process.env.PORT || '5173'),
  },
})
