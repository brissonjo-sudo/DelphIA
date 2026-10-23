#!/usr/bin/env node
import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { startBridge } from './server.js'

const USAGE = 'Usage : delphia-bridge --project <dossier> [--designer-dir <dossier>]'

function fatal(message: string, code: number): never {
  console.error(`DelphIA bridge : ${message}`)
  process.exit(code)
}

async function main(): Promise<void> {
  let values: { project?: string; 'designer-dir'?: string; help?: boolean }
  try {
    values = parseArgs({
      options: {
        project: { type: 'string' },
        'designer-dir': { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
      allowPositionals: false,
    }).values
  } catch (e) {
    return fatal(`${(e as Error).message}\n${USAGE}`, 2)
  }
  if (values.help) {
    console.log(USAGE)
    return
  }
  if (!values.project) return fatal(`--project est obligatoire\n${USAGE}`, 2)
  const project = resolve(values.project)
  const isDir = await stat(project).then(
    s => s.isDirectory(),
    () => false,
  )
  if (!isDir) return fatal(`dossier de projet introuvable : ${project}`, 2)

  const bridge = await startBridge({
    project,
    ...(values['designer-dir'] ? { designerDir: values['designer-dir'] } : {}),
    log: line => console.log(line),
  })

  const stop = (): void => {
    bridge.close().then(
      () => process.exit(0),
      () => process.exit(1),
    )
  }
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK'] as const) process.on(signal, stop)
}

main().catch(e => fatal((e as Error).message, 1))
