import { randomUUID } from 'node:crypto'
import { rename, rm, writeFile } from 'node:fs/promises'

const RENAME_RETRIES = 5
const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))

/** Écrit `text` dans `file` de façon atomique (fichier temporaire puis renommage). */
export async function atomicWrite(file: string, text: string): Promise<void> {
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
