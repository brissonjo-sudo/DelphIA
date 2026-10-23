// Section de prompt et suivi des révisions d'overrides.json.
import type { PromptComposeSection } from 'claude-code'

import { describeDiff, diffOverrides, summarizeForPrompt } from '../vendor/protocol/index.js'
import type { OverridesDoc } from '../vendor/protocol/index.js'
import type { Ctx } from './project.js'

const SEEN = { plugin: 'delphia', key: 'seen' } as const

export const SECTION_ID = 'delphia:overrides'

/** Section à ajouter en dernier, ou undefined s'il n'y a rien d'épinglé. */
export function overridesSection(doc: OverridesDoc | undefined): PromptComposeSection | undefined {
  const text = doc ? summarizeForPrompt(doc) : ''
  return text ? { id: SECTION_ID, text, scope: 'session' } : undefined
}

/** Mémorise le document vu, sans notification (démarrage de session). */
export async function rememberSeen($: Ctx, doc: OverridesDoc | undefined): Promise<void> {
  if (doc) await $.state.set(SEEN, doc)
}

/**
 * Compare `doc` à la dernière version vue ; renvoie la phrase à afficher
 * (chaîne vide si rien n'a changé) et mémorise `doc`.
 */
export async function noteRevision($: Ctx, doc: OverridesDoc | undefined): Promise<string> {
  if (!doc) return ''
  const { value: prev } = await $.state.get(SEEN)
  if (prev && prev.revision === doc.revision) return ''
  await $.state.set(SEEN, doc)
  return prev ? describeDiff(diffOverrides(prev, doc)) : ''
}
