import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'

const port = Number(process.env.PORT ?? 3000)
const server = (
  await import(
    pathToFileURL(new URL('./dist/server/server.js', import.meta.url).pathname)
      .href
  )
).default

createServer(async (req, res) => {
  try {
    const host = req.headers.host ?? 'localhost'
    const url = new URL(req.url ?? '/', `http://${host}`)
    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (value == null) continue
      if (Array.isArray(value)) {
        for (const item of value) headers.append(key, item)
      } else headers.append(key, value)
    }
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
    const request = new Request(url, {
      method: req.method,
      headers,
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
