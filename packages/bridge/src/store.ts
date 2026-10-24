import { randomUUID } from 'node:crypto'
import { watch, type FSWatcher } from 'node:fs'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  DELPHIA_DIR,
  OVERRIDES_FILE,
  applyPatch,
  emptyOverrides,
  parseOverrides,
  type GeometryPatch,
  type OverridesDoc,
} from '@vite-plugin-delphia/protocol'

export interface Store {
  current(): OverridesDoc
  /** `patch === null` retire tout l'ajustement de l'élément. Écritures sérialisées. */
  apply(id: string, patch: GeometryPatch | null): Promise<OverridesDoc>
  close(): void
}

const OVERRIDES_NAME = 'overrides.json'
const DEBOUNCE_MS = 50
const RENAME_RETRIES = 5

const serialize = (doc: OverridesDoc): string => `${JSON.stringify(doc, null, 2)}\n`
const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))

async function readDisk(file: string): Promise<{ doc: OverridesDoc; text: string } | null> {
  let text: string
  try {
    text = await readFile(file, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`${OVERRIDES_FILE} n'est pas du JSON valide`)
  }
  const parsed = parseOverrides(json)
  if (!parsed.ok) throw new Error(`${OVERRIDES_FILE} invalide : ${parsed.errors.join(' ; ')}`)
  return { doc: parsed.value, text }
}

async function atomicWrite(file: string, text: string): Promise<void> {
  const tmp = `${file}.${randomUUID().slice(0, 8)}.tmp`
  await writeFile(tmp, text)
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(tmp, file)
      return
    } catch (e) {
      // Windows : un lecteur concurrent peut bloquer brièvement le renommage.
      const code = (e as NodeJS.ErrnoException).code
      const transient = code === 'EPERM' || code === 'EBUSY' || code === 'EACCES'
      if (!transient || attempt >= RENAME_RETRIES) {
        await rm(tmp, { force: true })
        throw e
      }
      await sleep(20 * (attempt + 1))
    }
  }
}

/**
 * Ouvre `overrides.json` du projet. Seul point d'écriture du fichier.
 * `onExternalChange` reçoit les documents valides modifiés hors du pont (jamais ses propres écritures).
 */
export async function openStore(
  project: string,
  onExternalChange: (doc: OverridesDoc) => void,
  log: (line: string) => void,
): Promise<Store> {
  const dir = join(project, DELPHIA_DIR)
  const file = join(project, OVERRIDES_FILE)
  await mkdir(dir, { recursive: true })

  // Un fichier invalide au démarrage est une erreur : on ne l'écrase jamais en silence.
  const initial = await readDisk(file)
  let doc = initial?.doc ?? emptyOverrides()
  let lastText: string | null = initial?.text ?? null

  let queue: Promise<unknown> = Promise.resolve()
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const result = queue.then(task)
    queue = result.catch(() => undefined)
    return result
  }

  const syncFromDisk = async (): Promise<void> => {
    let disk: Awaited<ReturnType<typeof readDisk>>
    try {
      disk = await readDisk(file)
    } catch (e) {
      log(`modification externe ignorée : ${(e as Error).message}`)
      return
    }
    if (disk === null) {
      if (Object.keys(doc.elements).length === 0) return
      doc = { ...emptyOverrides(), revision: doc.revision + 1 }
      lastText = null
    } else {
      if (disk.text === lastText) return // notre propre écriture
      doc = disk.doc
      lastText = disk.text
    }
    onExternalChange(doc)
  }

  let timer: NodeJS.Timeout | undefined
  const watcher: FSWatcher = watch(dir, { persistent: false }, (_event, name) => {
    if (name && name !== OVERRIDES_NAME) return
    clearTimeout(timer)
    timer = setTimeout(() => void enqueue(syncFromDisk).catch(() => undefined), DEBOUNCE_MS)
  })
  watcher.on('error', e => log(`surveillance de ${OVERRIDES_FILE} interrompue : ${e.message}`))

  return {
    current: () => doc,
    apply: (id, patch) =>
      enqueue(async () => {
        const disk = await readDisk(file) // repart du disque : intègre une édition externe récente
        const base = disk?.doc ?? { ...emptyOverrides(), revision: doc.revision }
        const next = applyPatch(base, id, patch, new Date())
        const text = serialize(next)
        const previous = lastText
        lastText = text // posé avant le renommage pour que le watcher reconnaisse l'écriture
        try {
          await atomicWrite(file, text)
        } catch (e) {
          lastText = previous
          throw e
        }
        doc = next
        return next
      }),
    close: () => {
      clearTimeout(timer)
      watcher.close()
    },
  }
}
