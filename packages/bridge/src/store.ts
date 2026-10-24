import { watch, type FSWatcher } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  DELPHIA_DIR,
  OVERRIDES_FILE,
  applyPatch,
  emptyOverrides,
  parseOverrides,
  type GeometryPatch,
  type OverridesDoc,
} from '@vite-plugin-delph-ia/protocol'
import { atomicWrite } from './fs-atomic.js'

/** Accès au disque réservé à une tâche de `Store.run`. */
export interface StoreTx {
  /** Dernier état écrit sur le disque (intègre une édition externe récente). */
  read(): Promise<OverridesDoc>
  write(doc: OverridesDoc): Promise<void>
}

export interface Store {
  current(): OverridesDoc
  /** `patch === null` retire tout l'ajustement de l'élément. Écritures sérialisées. */
  apply(id: string, patch: GeometryPatch | null): Promise<OverridesDoc>
  /**
   * Exécute `task` dans la file des écritures (jamais entrelacée avec `apply`), ce qui permet
   * à un autre module de modifier `overrides.json` et son propre fichier d'un seul tenant.
   */
  run<T>(task: (tx: StoreTx) => Promise<T>): Promise<T>
  close(): void
}

const OVERRIDES_NAME = 'overrides.json'
const DEBOUNCE_MS = 50

const serialize = (doc: OverridesDoc): string => `${JSON.stringify(doc, null, 2)}\n`

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

  const tx: StoreTx = {
    read: async () => {
      const disk = await readDisk(file) // repart du disque : intègre une édition externe récente
      return disk?.doc ?? { ...emptyOverrides(), revision: doc.revision }
    },
    write: async next => {
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
    },
  }

  return {
    current: () => doc,
    run: task => enqueue(() => task(tx)),
    apply: (id, patch) =>
      enqueue(async () => {
        const next = applyPatch(await tx.read(), id, patch, new Date())
        await tx.write(next)
        return next
      }),
    close: () => {
      clearTimeout(timer)
      watcher.close()
    },
  }
}
