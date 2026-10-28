import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const port = Number(process.env.PORT ?? 3000)
const root = fileURLToPath(new URL('.', import.meta.url))
const clientDir = join(root, 'dist', 'client')
const server = (
  await import(pathToFileURL(join(root, 'dist', 'server', 'server.js')).href)
).default

const types = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

function staticFile(pathname) {
  const safe = normalize(decodeURIComponent(pathname)).replace(
    /^(\.\.[/\\])+/,
    '',
  )
  const file = join(clientDir, safe)
  if (
    !file.startsWith(clientDir) ||
    !existsSync(file) ||
    !statSync(file).isFile()
  )
    return null
  return file
}

function toHeaders(req) {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item)
    } else headers.append(key, value)
  }
  return headers
}

createServer(async (req, res) => {
  try {
    const host = req.headers.host ?? 'localhost'
    const url = new URL(req.url ?? '/', `http://${host}`)
    const file =
      req.method === 'GET' || req.method === 'HEAD'
        ? staticFile(url.pathname)
        : null
    if (file) {
      const immutable = url.pathname.startsWith('/assets/')
      res.writeHead(200, {
        'content-type': types[extname(file)] ?? 'application/octet-stream',
        'cache-control': immutable
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=600',
      })
      if (req.method === 'HEAD') return res.end()
      return createReadStream(file).pipe(res)
    }
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
    const request = new Request(url, {
      method: req.method,
      headers: toHeaders(req),
      body: hasBody ? req : undefined,
      duplex: 'half',
    })
    const response = await server.fetch(request)
    res.writeHead(
      response.status,
      Object.fromEntries(response.headers.entries()),
    )
    res.end(Buffer.from(await response.arrayBuffer()))
  } catch (error) {
    console.error(error)
    res.writeHead(500, { 'content-type': 'text/plain' })
    res.end('server error')
  }
}).listen(port, '0.0.0.0')
