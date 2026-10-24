// « Figer » côté mod (ADR 0003) : détecter la demande, préparer le tour de Claude, suivre les
// fichiers modifiés, prévenir le pont. Aucune fonction exportée ne lève : erreur = trace + toast.
import type { PluginOptions } from 'claude-code'

import {
  BAKE_APPLIED_ROUTE,
  BAKE_CANCEL_ROUTE,
  BRIDGE_TOKEN_HEADER,
  MAX_TOUCHED_FILES,
  bakeInstructions,
  bakeTrigger,
  findBakeId,
} from '../vendor/protocol/index.js'
import type { OverridesDoc } from '../vendor/protocol/index.js'
import { readBake, readBridgeInfo } from './project.js'
import type { Ctx } from './project.js'

const SEEN = { plugin: 'delphia', key: 'bakeSeen' } as const
const ACTIVE = { plugin: 'delphia', key: 'bakeActive' } as const
const LAST = { plugin: 'delphia', key: 'bakeLast' } as const

export type FigerMode = 'preremplir' | 'direct'

/** Option `figer` du plugin ; toute valeur inconnue donne le défaut. */
export const figerMode = (options: PluginOptions): FigerMode =>
  options.figer === 'direct' ? 'direct' : 'preremplir'

const message = (err: unknown): string => (err instanceof Error ? err.message : 'erreur')

export async function readActive($: Ctx) {
  const { value } = await $.state.get(ACTIVE)
  return value ?? null
}

/** Retire les ids du document d'ajustements (section de verrous du tour de figeage). */
export function withoutIds(
  doc: OverridesDoc | undefined,
  ids: readonly string[],
): OverridesDoc | undefined {
  if (!doc) return doc
  return {
    ...doc,
    elements: Object.fromEntries(Object.entries(doc.elements).filter(([id]) => !ids.includes(id))),
  }
}

/** Chemin relatif au projet, séparateur `/`. Hors projet : chemin absolu normalisé. */
export function relativeTo(cwd: string, path: string): string {
  const root = cwd.replaceAll('\\', '/').replace(/\/+$/, '')
  const p = path.replaceAll('\\', '/')
  // shortcut: comparaison insensible à la casse (Windows), faux positif possible sous Linux.
  return p.toLowerCase().startsWith(`${root.toLowerCase()}/`) ? p.slice(root.length + 1) : p
}

// ── Détection ───────────────────────────────────────────────────────────────

let busy = false

/** Une demande `requested` jamais vue : préremplit la zone de saisie, ou envoie (option `direct`). */
export async function detectBake($: Ctx, cwd: string, mode: FigerMode): Promise<void> {
  if (busy) return
  busy = true
  try {
    const cur = (await readBake($, cwd))?.current
    if (!cur || cur.status !== 'requested') return
    if ((await $.state.get(SEEN)).value === cur.bakeId) return
    const text = bakeTrigger(cur.bakeId)
    if (mode === 'direct') {
      await $.state.set(SEEN, cur.bakeId)
      await $.prompt.submit({ text })
      $.ui.toast('DelphIA : figeage lancé')
      return
    }
    const res = await $.prompt.fill({ text, mode: 'replace' })
    if (!res.isFilled && res.refusal === 'dialog') return // on réessaiera au prochain passage
    await $.state.set(SEEN, cur.bakeId)
    $.ui.toast(
      res.isFilled
        ? 'DelphIA : figeage demandé, validez (Entrée) dans la zone de saisie'
        : `DelphIA : figeage demandé, saisissez : ${text}`,
    )
  } catch (err) {
    $.ui.log(`delphia: détection du figeage en échec (${message(err)})`, { to: 'debug' })
  } finally {
    busy = false
  }
}

// ── Tour de figeage ─────────────────────────────────────────────────────────

/** Contexte à ajouter au prompt si `text` porte l'id de la demande `requested` courante. */
export async function startBakeTurn(
  $: Ctx,
  cwd: string,
  text: string,
): Promise<string | undefined> {
  try {
    const id = findBakeId(text)
    if (!id) return undefined
    const cur = (await readBake($, cwd))?.current
    if (!cur || cur.status !== 'requested' || cur.bakeId !== id) return undefined
    await $.state.set(SEEN, id)
    await $.state.set(ACTIVE, { bakeId: id, ids: cur.items.map(i => i.id), files: [] })
    return bakeInstructions(cur)
  } catch (err) {
    $.ui.log(`delphia: début du figeage en échec (${message(err)})`, { to: 'debug' })
    return undefined
  }
}

/** Le prompt n'est finalement pas entré : le tour de figeage n'aura pas lieu. */
export async function dropBakeTurn($: Ctx): Promise<void> {
  await $.state.set(ACTIVE, null).catch(() => undefined)
}

/** Note le fichier d'une écriture réussie pendant le tour actif. */
export async function noteTouched(
  $: Ctx,
  cwd: string,
  input: Record<string, unknown>,
  outcome: { deny?: string; isError?: true },
): Promise<void> {
  try {
    if (outcome.deny !== undefined || outcome.isError) return
    const raw = input.file_path ?? input.notebook_path
    const active = await readActive($)
    if (!active || typeof raw !== 'string') return
    const path = relativeTo(cwd, raw)
    if (active.files.includes(path) || active.files.length >= MAX_TOUCHED_FILES) return
    await $.state.set(ACTIVE, { ...active, files: [...active.files, path] })
  } catch (err) {
    $.ui.log(`delphia: suivi des fichiers en échec (${message(err)})`, { to: 'debug' })
  }
}

// ── Fin de tour ─────────────────────────────────────────────────────────────

async function report($: Ctx, text: string): Promise<void> {
  $.ui.toast(text)
  await $.state.set(LAST, text).catch(() => undefined)
}

/** Prévient le pont : `applied` si le tour a abouti (réponse normale), sinon `cancel`. */
export async function finishBake($: Ctx, cwd: string, reason: string): Promise<void> {
  try {
    const active = await readActive($)
    if (!active) return
    await $.state.set(ACTIVE, null)
    const info = await readBridgeInfo($, cwd)
    if (!info) {
      return await report($, 'DelphIA : bridge.json absent ou sans jeton valide, pont non prévenu')
    }
    const applied = reason === 'answer'
    const route = applied ? BAKE_APPLIED_ROUTE : BAKE_CANCEL_ROUTE
    const body = applied
      ? { bakeId: active.bakeId, touchedFiles: active.files }
      : { bakeId: active.bakeId, note: `Tour de Claude terminé sans succès (${reason})` }
    const res = await $.http.fetch(`http://127.0.0.1:${info.port}${route}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [BRIDGE_TOKEN_HEADER]: info.token },
      body: JSON.stringify(body),
    })
    await report(
      $,
      res.ok
        ? applied
          ? `DelphIA : figeage transmis (${active.files.length} fichier(s))`
          : `DelphIA : figeage annulé (${reason})`
        : `DelphIA : le pont a refusé la notification du figeage (HTTP ${res.status})`,
    )
  } catch (err) {
    await report($, `DelphIA : pont injoignable pour le figeage (${message(err)})`)
  }
}

// ── /delphia ────────────────────────────────────────────────────────────────

export async function bakeReport($: Ctx, cwd: string): Promise<string[]> {
  const cur = (await readBake($, cwd))?.current
  const lines = [
    cur
      ? `Figeage : ${cur.bakeId} (${cur.status}), ${cur.items.length} élément(s)`
      : 'Figeage : aucune demande en cours',
  ]
  if ((await readActive($)) !== null) lines.push('Figeage : tour de Claude en cours')
  const last = (await $.state.get(LAST)).value
  if (last) lines.push(last)
  return lines
}
