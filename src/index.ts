import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFile, writeFile, mkdir, unlink, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'

export const name = 'dsh-logo-custom'
export const inject = ['connection', 'webServer'] as const

export interface Config { storageDir?: string }
export const Config = Schema.object({
  storageDir: Schema.string().description('Logo图片存储目录，默认 ~/.dsh/data/dsh-logo-custom'),
})

const RPC_CHANNEL = '/rpc'
const RPC_PREFIX = 'logo-custom/'
const LOGO_PREFIX = 'logo'
const WORDMARK_PREFIX = 'wordmark'

interface HostRpc {
  handle(channel: string, handler: (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<RpcResult>, options: { authority: 'loopback' | 'trusted-host' }): () => Promise<void>
}
interface RpcResult { ok: boolean; value?: unknown; error?: { message: string } }
interface WebServer { register(route: { kind: 'exact' | 'prefix'; path: string; handler: (req: any, res: any) => void | Promise<void> }): () => void }

const MIME_MAP: Record<string, string> = {
  'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
  'gif': 'image/gif', 'svg': 'image/svg+xml', 'webp': 'image/webp',
  'ico': 'image/x-icon', 'bmp': 'image/bmp',
}
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp', 'image/x-icon', 'image/bmp']

async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
}

async function findFile(dir: string, prefix: string): Promise<{ ext: string; mime: string } | null> {
  try {
    const files = await readdir(dir)
    const match = files.find(f => f.startsWith(prefix + '.'))
    if (!match) return null
    const ext = match.slice(prefix.length + 1).toLowerCase()
    return { ext, mime: MIME_MAP[ext] ?? 'application/octet-stream' }
  } catch { return null }
}

async function removeFiles(dir: string, prefix: string): Promise<void> {
  try {
    const files = await readdir(dir)
    for (const f of files) { if (f.startsWith(prefix + '.')) await unlink(join(dir, f)) }
  } catch { /* ignore */ }
}

function parseMultipartBody(req: any): Promise<{ fields: Record<string, string>; file: { data: Buffer; filename: string; mime: string } | null }> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] ?? ''
    const boundaryMatch = contentType.match(/boundary=(.+)/)
    if (!boundaryMatch) { reject(new Error('No boundary in Content-Type')); return }
    const boundary = boundaryMatch[1]
    const chunks: Buffer[] = []; let totalLength = 0
    req.on('data', (chunk: Buffer) => { chunks.push(chunk); totalLength += chunk.length })
    req.on('end', () => {
      const body = Buffer.concat(chunks, totalLength)
      const boundaryBuf = Buffer.from('--' + boundary)
      const result: any = { fields: {}, file: null }
      let pos = 0
      while (pos < body.length) {
        const start = body.indexOf(boundaryBuf, pos)
        if (start === -1) break
        const nextStart = body.indexOf(boundaryBuf, start + boundaryBuf.length)
        if (nextStart === -1) break
        const part = body.slice(start + boundaryBuf.length, nextStart)
        const headerEnd = part.indexOf('\r\n\r\n')
        if (headerEnd === -1) { pos = nextStart; continue }
        const headerStr = part.slice(0, headerEnd).toString('utf-8')
        const data = part.slice(headerEnd + 4, part.length - 2)
        const nameMatch = headerStr.match(/name="([^"]+)"/)
        const filenameMatch = headerStr.match(/filename="([^"]+)"/)
        const contentTypeMatch = headerStr.match(/Content-Type:\s*(.+)/i)
        if (filenameMatch && nameMatch) {
          result.file = { data, filename: filenameMatch[1], mime: contentTypeMatch?.[1]?.trim() ?? 'application/octet-stream' }
        } else if (nameMatch) {
          result.fields[nameMatch[1]] = data.toString('utf-8')
        }
        pos = nextStart
      }
      resolve(result)
    })
    req.on('error', reject)
  })
}

function registerImageRoutes(prefix: string, getPath: string, uploadPath: string, webServer: WebServer, storageDir: string, ctx: Context): () => void {
  // GET/DELETE handler
  const getDispose = webServer.register({
    kind: 'exact', path: getPath,
    handler: async (req: any, res: any) => {
      if (req.method === 'DELETE') {
        try {
          await removeFiles(storageDir, prefix)
          ctx.logger.info('dsh-logo-custom: ' + prefix + ' deleted')
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: String(err) }))
        }
        return
      }
      try {
        const info = await findFile(storageDir, prefix)
        if (!info) {
          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('Not configured')
          return
        }
        const data = await readFile(join(storageDir, prefix + '.' + info.ext))
        res.writeHead(200, { 'Content-Type': info.mime, 'Cache-Control': 'no-cache, no-store, must-revalidate' })
        res.end(data)
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('Internal error')
      }
    },
  })

  // POST upload handler  
  const uploadDispose = webServer.register({
    kind: 'exact', path: uploadPath,
    handler: async (req: any, res: any) => {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'text/plain' })
        res.end('Method not allowed')
        return
      }
      try {
        await ensureDir(storageDir)
        const { file } = await parseMultipartBody(req)
        if (!file) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'No file uploaded' }))
          return
        }
        if (!ALLOWED_TYPES.includes(file.mime)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'Unsupported image type' }))
          return
        }
        await removeFiles(storageDir, prefix)
        const ext = file.mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png'
        await writeFile(join(storageDir, prefix + '.' + ext), file.data)
        ctx.logger.info('dsh-logo-custom: ' + prefix + ' uploaded (' + file.mime + ', ' + file.data.length + ' bytes)')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, url: getPath }))
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        ctx.logger.error('dsh-logo-custom: ' + prefix + ' upload failed: ' + message)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: message }))
      }
    },
  })

  return () => { getDispose(); uploadDispose() }
}

export function apply(ctx: Context, config: Config): void {
  const storageDir = config.storageDir ?? join(homedir(), '.dsh', 'data', 'dsh-logo-custom')

  const webServer = ctx.get('webServer') as WebServer | undefined
  if (!webServer) { ctx.logger.warn('dsh-logo-custom: no webServer service'); return }

  const disposers: (() => void)[] = []
  disposers.push(registerImageRoutes(LOGO_PREFIX, '/dsh-logo-custom/logo', '/dsh-logo-custom/upload', webServer, storageDir, ctx))
  disposers.push(registerImageRoutes(WORDMARK_PREFIX, '/dsh-logo-custom/wordmark', '/dsh-logo-custom/wordmark-upload', webServer, storageDir, ctx))

  ctx.effect(() => () => { for (const d of disposers) d() }, 'dsh-logo-custom: routes')

  // RPC handler (optional, for legacy support)
  const connection = ctx.get('connection') as { rpc?: HostRpc } | undefined
  if (!connection?.rpc) return

  const rpcHandler = async (endpoint: string, payload: unknown, _signal: AbortSignal): Promise<RpcResult> => {
    if (!endpoint.startsWith(RPC_PREFIX)) return { ok: false, error: { message: 'unknown endpoint ' + endpoint } }
    try {
      switch (endpoint.slice(RPC_PREFIX.length)) {
        case 'status': {
          const logo = await findFile(storageDir, LOGO_PREFIX)
          const wordmark = await findFile(storageDir, WORDMARK_PREFIX)
          return { ok: true, value: { logo: { hasLogo: logo !== null, url: logo ? '/dsh-logo-custom/logo' : null, mime: logo?.mime ?? null }, wordmark: { hasLogo: wordmark !== null, url: wordmark ? '/dsh-logo-custom/wordmark' : null, mime: wordmark?.mime ?? null } } }
        }
        case 'remove': {
          await removeFiles(storageDir, LOGO_PREFIX); await removeFiles(storageDir, WORDMARK_PREFIX)
          return { ok: true, value: { hasLogo: false } }
        }
        default: return { ok: false, error: { message: 'unknown endpoint ' + endpoint } }
      }
    } catch (err) { return { ok: false, error: { message: err instanceof Error ? err.message : String(err) } } }
  }

  let rpcDispose: (() => void) | undefined
  try {
    const remove = connection.rpc.handle(RPC_CHANNEL, rpcHandler, { authority: 'loopback' })
    rpcDispose = () => { void remove() }
  } catch (err) { ctx.logger.error('dsh-logo-custom: failed to register RPC: ' + String(err)) }

  ctx.effect(() => () => { rpcDispose?.() }, 'dsh-logo-custom: rpc')
}