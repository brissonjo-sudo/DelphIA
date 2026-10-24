import { readFile, realpath, stat } from 'node:fs/promises'
import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http'
import { extname, isAbsolute, join, relative } from 'node:path'
import type { BakeRoutes } from './bake-routes.js'

export interface HttpDeps {
  /** Routes `POST` du mod (jeton) ; absentes = tout `POST` est refusé (405). */
  bakeRoutes?: BakeRoutes
  designerDir: string
  appPort: number
  /** Port réellement écouté (connu après `listen`, utile avec le port 0 des tests). */
  getPort(): number
}

/** Types servis : tout autre fichier du dossier du concepteur est refusé. */
const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

const HTML_TYPE = 'text/html; charset=utf-8'
const FALLBACK_HTML = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>DelphIA</title></head>
<body><h1>DelphIA</h1>
<p>Concepteur non buildé : <code>npm run build -w @vite-plugin-delph-ia/designer</code></p></body></html>
`

/** Anti DNS-rebinding : seuls `127.0.0.1:<port>` et `localhost:<port>` sont acceptés. */
export function hostAllowed(host: string | undefined, port: number): boolean {
  const h = host?.toLowerCase()
  return h === `127.0.0.1:${port}` || h === `localhost:${port}`
}

function send(
  res: ServerResponse,
  status: number,
  type: string,
  body: string | Buffer,
  head = false,
): void {
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(body),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  })
  res.end(head ? undefined : body)
}

const text = (res: ServerResponse, status: number, message: string, head = false): void =>
  send(res, status, 'text/plain; charset=utf-8', message, head)

/** Décode le chemin brut de la requête ; `null` si traversée, octet nul, `\` ou `:` (flux NTFS). */
function decodePath(rawUrl: string): string | null {
  const end = rawUrl.search(/[?#]/)
  const raw = end === -1 ? rawUrl : rawUrl.slice(0, end)
  if (!raw.startsWith('/')) return null
  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return null
  }
  if (/[\0\\:]/.test(decoded) || decoded.split('/').includes('..')) return null
  return decoded
}

type Resolved = { file: string } | { status: 403 | 404 }

/** Chemin demandé → fichier réel, confiné à `root` (liens symboliques résolus par `realpath`). */
async function resolveStatic(designerDir: string, urlPath: string): Promise<Resolved> {
  let root: string
  try {
    root = await realpath(designerDir)
  } catch {
    return { status: 404 }
  }
  const inside = (p: string): boolean => {
    const rel = relative(root, p)
    return !rel.startsWith('..') && !isAbsolute(rel)
  }
  try {
    let real = await realpath(join(root, urlPath))
    if (!inside(real)) return { status: 403 }
    if ((await stat(real)).isDirectory()) {
      real = await realpath(join(real, 'index.html'))
      if (!inside(real)) return { status: 403 }
    }
    return { file: real }
  } catch {
    return { status: 404 }
  }
}

async function serveStatic(
  deps: HttpDeps,
  urlPath: string,
  res: ServerResponse,
  head: boolean,
): Promise<void> {
  const resolved = await resolveStatic(deps.designerDir, urlPath)
  if ('file' in resolved) {
    const type = MIME[extname(resolved.file).toLowerCase()]
    if (type) return send(res, 200, type, await readFile(resolved.file), head)
    return text(res, 404, 'Not found', head)
  }
  // Concepteur non buildé : page d'aide à la racine seulement.
  if (resolved.status === 404 && (urlPath === '/' || urlPath === '/index.html')) {
    const built = await stat(deps.designerDir).then(
      s => s.isDirectory(),
      () => false,
    )
    if (!built) return send(res, 200, HTML_TYPE, FALLBACK_HTML, head)
  }
  text(res, resolved.status, resolved.status === 403 ? 'Forbidden' : 'Not found', head)
}

export function createRequestHandler(deps: HttpDeps): RequestListener {
  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!hostAllowed(req.headers.host, deps.getPort())) return text(res, 403, 'Forbidden')
    if (deps.bakeRoutes && (await deps.bakeRoutes(req, res))) return
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD')
      return text(res, 405, 'Method not allowed')
    }
    const head = req.method === 'HEAD'
    const urlPath = decodePath(req.url ?? '/')
    if (urlPath === null) return text(res, 403, 'Forbidden', head)
    if (urlPath === '/api/config') {
      const body = JSON.stringify({
        appUrl: `http://localhost:${deps.appPort}`,
        port: deps.getPort(),
      })
      return send(res, 200, 'application/json; charset=utf-8', body, head)
    }
    await serveStatic(deps, urlPath, res, head)
  }
  return (req, res) => {
    handle(req, res).catch(() => {
      if (res.headersSent) res.destroy()
      else text(res, 500, 'Internal error')
    })
  }
}
