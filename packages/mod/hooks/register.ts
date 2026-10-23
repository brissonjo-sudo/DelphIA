// Mod DelphIA : assemblage des hooks. La logique vit dans hooks/lib/.
import type { Register } from 'claude-code'

import { startBridge } from './lib/bridge.js'
import { delphiaReport } from './lib/command.js'
import { judgeToolCall } from './lib/guard.js'
import { isActive, readOverrides } from './lib/project.js'
import { noteRevision, overridesSection, rememberSeen } from './lib/prompt.js'

// MultiEdit n'existe pas dans tous les builds (absent des types de celui-ci) : matcher par regex.
const GUARDED = /^(Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell)$/

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    if (await isActive($, e.cwd)) {
      await $.command.register({
        name: 'delphia',
        description: 'État du pont DelphIA et éléments épinglés',
      })
      await rememberSeen($, await readOverrides($, e.cwd))
      await startBridge($, e.cwd)
    }
    return next(e)
  })

  on('tool.call', { tool: GUARDED }, async ($, e, next) => {
    const cwd = await $.session.cwd()
    if (!(await isActive($, cwd))) return next(e)
    const doc = await readOverrides($, cwd)
    const denial = await judgeToolCall($, String(e.tool), e as Record<string, unknown>, doc)
    return denial === undefined ? next(e) : { deny: denial }
  }).catch(($, e, next) =>
    next.called ? next(e) : { deny: 'DelphIA : sa garde a échoué, appel refusé par prudence.' },
  )

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    const cwd = await $.session.cwd()
    if (!(await isActive($, cwd))) return composed
    const section = overridesSection(await readOverrides($, cwd))
    return section ? { sections: [...composed.sections, section] } : composed
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const cwd = await $.session.cwd()
      if (await isActive($, cwd)) {
        const text = await noteRevision($, await readOverrides($, cwd))
        if (text) $.ui.toast(text)
      }
    }
    return next(e)
  })

  on('command.run', { command: 'delphia' }, async $ => ({
    text: await delphiaReport($, await $.session.cwd()),
  }))
}
