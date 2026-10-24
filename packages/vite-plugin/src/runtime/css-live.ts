import { isRecord } from '@vite-plugin-delph-ia/protocol'
import { OVERRIDES_EVENT, type HotLike } from './hot.js'

/**
 * Garde la balise `<style data-delphia>` à jour (HMR) et en dernier dans `<head>` :
 * en dev, Vite ajoute le CSS de l'app après le HTML initial.
 * Actif dans toute page servie par Vite, iframe ou non.
 */
export function startCssLive(doc: Document, hot: HotLike | undefined): void {
  let style = doc.querySelector<HTMLStyleElement>('style[data-delphia]')
  if (!style) {
    style = doc.createElement('style')
    style.setAttribute('data-delphia', '')
  }
  const tag = style
  const keepLast = (): void => {
    if (doc.head.lastElementChild !== tag) doc.head.append(tag)
  }
  keepLast()
  new MutationObserver(keepLast).observe(doc.head, { childList: true })

  hot?.on(OVERRIDES_EVENT, data => {
    if (isRecord(data) && typeof data.css === 'string') tag.textContent = data.css
  })
}
