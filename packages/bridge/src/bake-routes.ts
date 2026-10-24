import { timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  BAKE_APPLIED_ROUTE,
  BAKE_CANCEL_ROUTE,
  BRIDGE_TOKEN_HEADER,
  parseBakeAppliedBody,
  parseBakeCancelBody,
} from '@vite-plugin-delph-ia/protocol'
import type { BakeResultOf, BakeStore } from './bake-store.js'

export const MAX_BODY_BYTES = 64 * 1024

export interface BakeRoutesDeps {
  bake: BakeStore
  token: string
}

/** Vrai si les deux jetons sont identiques ; comparaison à temps constant (longueurs égales). */
export function tokenMatches(given: string | undefined, token: string): boolean {
  if (given === undefined) return false
  const a = Buffer.from(given)
  const b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}

function reply(res: ServerResponse, status: number, body: object): void {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
    ...(status === 413 ? { Connection: 'close' } : {}),
  })
  res.end(text)
}

type Body = { value: unknown } | 'too-big' | 'invalid'

/** Corps JSON ≤ 64 Ko. Un corps trop gros est lu jusqu'au bout sans être conservé. */
function readJson(req: IncomingMessage): Promise<Body> {
  return new Promise(resolve => {
    if (Number(req.headers['content-length'] ?? 0) > MAX_BODY_BYTES) {
      req.resume()
      return resolve('too-big')
    }
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size <= MAX_BODY_BYTES) chunks.push(c)
    })
    req.on('error', () => resolve('invalid'))
    req.on('end', () => {
      if (size > MAX_BODY_BYTES) return resolve('too-big')
      try {
        resolve({ value: JSON.parse(Buffer.concat(chunks).toString('utf8')) })
      } catch {
        resolve('invalid')
      }
    })
  })
}

/**
 * Routes `POST` du mod. Le contrôle `Host` est fait avant par le serveur HTTP.
 * Renvoie `true` si la requête visait une de ces routes (et a été traitée).
 */
export function createBakeRoutes(
  deps: BakeRoutesDeps,
): (req: IncomingMessage, res: ServerResponse) => Promise<boolean> {
  const handle = async (req: IncomingMessage, res: ServerResponse, path: string): Promise<void> => {
    if (req.headers.origin !== undefined) return reply(res, 403, { error: 'Origin interdit' })
    const header = req.headers[BRIDGE_TOKEN_HEADER]
    if (!tokenMatches(typeof header === 'string' ? header : undefined, deps.token)) {
      return reply(res, 401, { error: 'jeton absent ou invalide' })
    }
    if (!/^application\/json\s*(;|$)/i.test(req.headers['content-type'] ?? '')) {
      return reply(res, 415, { error: 'application/json attendu' })
    }
    const body = await readJson(req)
    if (body === 'too-big') return reply(res, 413, { error: 'corps trop gros' })
    if (body === 'invalid') return reply(res, 400, { error: 'JSON invalide' })

    let outcome: BakeResultOf
    if (path === BAKE_APPLIED_ROUTE) {
      const parsed = parseBakeAppliedBody(body.value)
      if (!parsed.ok) return reply(res, 400, { error: parsed.errors.join(' ; ').slice(0, 300) })
      outcome = await deps.bake.applied(parsed.value)
    } else {
      const parsed = parseBakeCancelBody(body.value)
      if (!parsed.ok) return reply(res, 400, { error: parsed.errors.join(' ; ').slice(0, 300) })
      outcome = await deps.bake.cancel(parsed.value.bakeId, parsed.value.note)
    }
    if (!outcome.ok) return reply(res, 409, { error: outcome.error })
    reply(res, 200, { ok: true })
  }

  return async (req, res) => {
    const path = (req.url ?? '').split(/[?#]/)[0] ?? ''
    if (req.method !== 'POST' || (path !== BAKE_APPLIED_ROUTE && path !== BAKE_CANCEL_ROUTE)) {
      return false
    }
    await handle(req, res, path)
    return true
  }
}

export type BakeRoutes = ReturnType<typeof createBakeRoutes>
