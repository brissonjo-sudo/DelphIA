// Mod DelphIA : assemblage des hooks. La logique vit dans hooks/lib/.
import type { Register } from 'claude-code'

import {
  detectBake,
  dropBakeTurn,
  figerMode,
  finishBake,
  noteTouched,
  readActive,
  startBakeTurn,
  withoutIds,
} from './lib/bake.js'
import { startBridge } from './lib/bridge.js'
import { delphiaReport } from './lib/command.js'
import { judgeToolCall } from './lib/guard.js'
import { isActive, readOverrides } from './lib/project.js'
import { noteRevision, overridesSection, rememberSeen } from './lib/prompt.js'

// MultiEdit n'existe pas dans tous les builds (absent des types de celui-ci) : matcher par regex.
const GUARDED = /^(Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell)$/

export const register: Register = (on, options) => {
  const mode = figerMode(options)

  on('session.start', async ($, e, next) => {
    if (await isActive($, e.cwd)) {
      await $.command.register({
        name: 'delphia',
        description: 'État du pont DelphIA et éléments épinglés',
      })
      await rememberSeen($, await readOverrides($, e.cwd))
      await startBridge($, e.cwd)
      $.clock.every(1000, () => void detectBake($, e.cwd, mode))
    }
    return next(e)
  })

  on('tool.call', { tool: GUARDED }, async ($, e, next) => {
    const cwd = await $.session.cwd()
    if (!(await isActive($, cwd))) return next(e)
    const doc = await readOverrides($, cwd)
    const denial = await judgeToolCall($, String(e.tool), e as Record<string, unknown>, doc)
    if (denial !== undefined) return { deny: denial }
    const res = await next(e)
    await noteTouched($, cwd, e as Record<string, unknown>, res) // ne lève jamais
    return res
  }).catch(($, e, next) =>
    next.called ? next(e) : { deny: 'DelphIA : sa garde a échoué, appel refusé par prudence.' },
  )

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    const cwd = await $.session.cwd()
    if (!(await isActive($, cwd))) return composed
    const active = await readActive($)
    const doc = await readOverrides($, cwd)
    const section = overridesSection(active ? withoutIds(doc, active.ids) : doc)
    return section ? { sections: [...composed.sections, section] } : composed
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const cwd = await $.session.cwd()
      if (await isActive($, cwd)) {
        void detectBake($, cwd, mode)
        const text = await noteRevision($, await readOverrides($, cwd))
        if (text) $.ui.toast(text)
      }
    }
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    const cwd = await $.session.cwd()
    const extra = (await isActive($, cwd)) ? await startBakeTurn($, cwd, e.text) : undefined
    if (extra === undefined) return next(e)
    const res = await next({ ...e, context: [...(e.context ?? []), extra] })
    if (res.drop !== undefined) await dropBakeTurn($)
    return res
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) await finishBake($, await $.session.cwd(), e.reason)
    return next(e)
  })

  on('command.run', { command: 'delphia' }, async $ => ({
    text: await delphiaReport($, await $.session.cwd()),
  }))
}
