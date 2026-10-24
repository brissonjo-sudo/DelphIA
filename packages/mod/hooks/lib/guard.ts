// Garde de tool.call : protège .delphia/ et les data-dz-id des éléments épinglés.
// Les fonctions ne lèvent jamais : une erreur d'IO donne « pas de refus » + trace debug.
import { DZ_ATTR, isProtectedPath } from '../vendor/protocol/index.js'
import type { OverridesDoc } from '../vendor/protocol/index.js'
import type { Ctx } from './project.js'

// Littéral : doit rester aligné sur DZ_ATTR (data-dz-id) et DZ_ID_PATTERN du protocole.
const ID_RE = /data-dz-id\s*=\s*\{?\s*["'`]([a-z][a-z0-9-]{0,63})["'`]/g

/** Ids data-dz-id présents dans un texte source. */
export function extractDzIds(source: string): Set<string> {
  return new Set(Array.from(source.matchAll(ID_RE), m => m[1] as string))
}

/** Ids épinglés présents avant l'édition et absents après. */
export function lostPinnedIds(before: string, after: string, pinned: readonly string[]): string[] {
  const was = extractDzIds(before)
  const is = extractDzIds(after)
  return pinned.filter(id => was.has(id) && !is.has(id)).sort()
}

const replaceText = (text: string, from: string, to: string, all: boolean): string => {
  if (from === '' || !text.includes(from)) return text
  if (all) return text.split(from).join(to)
  const i = text.indexOf(from)
  return text.slice(0, i) + to + text.slice(i + from.length)
}

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

/** Texte du fichier après l'édition demandée, ou undefined si on ne sait pas le calculer. */
export function applyEdit(
  tool: string,
  input: Record<string, unknown>,
  before: string,
): string | undefined {
  if (tool === 'Write') return str(input.content)
  if (tool === 'Edit') {
    const from = str(input.old_string)
    const to = str(input.new_string)
    return from === undefined || to === undefined
      ? undefined
      : replaceText(before, from, to, input.replace_all === true)
  }
  if (tool === 'MultiEdit' && Array.isArray(input.edits)) {
    let text = before
    for (const edit of input.edits as unknown[]) {
      const rec = (typeof edit === 'object' && edit !== null ? edit : {}) as Record<string, unknown>
      const from = str(rec.old_string)
      const to = str(rec.new_string)
      if (from === undefined || to === undefined) return undefined
      text = replaceText(text, from, to, rec.replace_all === true)
    }
    return text
  }
  return undefined
}

const WRITE_VERBS =
  /(^|[\s;&|(`])(rm|rmdir|mv|cp|del|erase|rd|ren|rename|move|copy|touch|truncate|tee|dd|ln|install|remove-item|set-content|add-content|out-file|new-item|move-item|copy-item|rename-item|clear-content|ri|sc|ac)(\s|$)/i
const REDIRECT_TO_DELPHIA = />>?\s*["']?[^\s|;&]*\.delphia/i
const IN_PLACE = /\b(sed|perl)\b[^|;&]*\s-[a-z]*i|--in-place/i

/** Refus best-effort d'une commande shell qui écrit dans .delphia/. */
export function shellWritesDelphia(command: string): boolean {
  if (!/\.delphia/i.test(command)) return false
  return WRITE_VERBS.test(command) || REDIRECT_TO_DELPHIA.test(command) || IN_PLACE.test(command)
}

const protectedMessage = (what: string): string =>
  `DelphIA : ${what} est protégé. .delphia/ est écrit uniquement par le pont DelphIA et par l'utilisateur ` +
  `(ajustements manuels). N'y touche pas : demande à l'utilisateur de le faire dans le concepteur.`

const lockedMessage = (ids: string[], path: string): string =>
  `DelphIA : cette édition de ${path} ferait disparaître ${DZ_ATTR} de ${ids.map(i => `« ${i} »`).join(', ')}. ` +
  `Cet élément est verrouillé par l'utilisateur (ajusté au pixel dans le concepteur). ` +
  `Conserve l'attribut ${DZ_ATTR}, ou demande d'abord à l'utilisateur l'autorisation de le retirer.`

async function readBefore($: Ctx, path: string): Promise<string | undefined> {
  try {
    return (await $.fs.exists(path)) ? await $.fs.read(path) : undefined
  } catch (err) {
    $.ui.log(
      `delphia: lecture de ${path} impossible (${err instanceof Error ? err.message : 'erreur'})`,
      { to: 'debug' },
    )
    return undefined
  }
}

/**
 * Juge un appel d'outil. Renvoie le message de refus, ou undefined pour laisser passer.
 * `doc` : ajustements du projet (undefined = rien d'épinglé).
 */
export async function judgeToolCall(
  $: Ctx,
  tool: string,
  input: Record<string, unknown>,
  doc: OverridesDoc | undefined,
): Promise<string | undefined> {
  try {
    if (tool === 'Bash' || tool === 'PowerShell') {
      const command = str(input.command) ?? ''
      return shellWritesDelphia(command)
        ? protectedMessage('le dossier .delphia/ (commande shell visant .delphia)')
        : undefined
    }
    const path = str(input.file_path) ?? str(input.notebook_path)
    if (path === undefined) return undefined
    if (isProtectedPath(path)) return protectedMessage(path)
    const pinned = Object.keys(doc?.elements ?? {})
    if (tool === 'NotebookEdit' || pinned.length === 0) return undefined
    const before = await readBefore($, path)
    if (before === undefined) return undefined
    const after = applyEdit(tool, input, before)
    if (after === undefined) return undefined
    const lost = lostPinnedIds(before, after, pinned)
    return lost.length ? lockedMessage(lost, path) : undefined
  } catch (err) {
    $.ui.log(`delphia: garde en erreur (${err instanceof Error ? err.message : 'erreur'})`, {
      to: 'debug',
    })
    return undefined
  }
}
