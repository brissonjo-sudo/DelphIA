import type {
  DesignerToRuntime,
  ElementInfo,
  Geometry,
  OverridesDoc,
  Rect,
  RuntimeToDesigner,
} from '@vite-plugin-delph-ia/protocol'
import type { RuntimeLink } from './runtime-link.js'

interface MockNode {
  id: string
  tag: string
  parentId: string | null
  base: Rect
  text: string
}

/** Fausse app : quelques rectangles, avec parenté, dans une fenêtre de 700 × 440 px. */
const NODES: MockNode[] = [
  { id: 'entete', tag: 'header', parentId: null, base: r(24, 16, 652, 56), text: '' },
  { id: 'titre', tag: 'h1', parentId: 'entete', base: r(40, 28, 200, 32), text: 'Mon application' },
  { id: 'bouton-aide', tag: 'button', parentId: 'entete', base: r(580, 28, 80, 32), text: 'Aide' },
  { id: 'carte', tag: 'section', parentId: null, base: r(24, 96, 420, 300), text: '' },
  {
    id: 'carte-titre',
    tag: 'h2',
    parentId: 'carte',
    base: r(44, 116, 380, 32),
    text: 'Nouveau contact',
  },
  {
    id: 'carte-texte',
    tag: 'p',
    parentId: 'carte',
    base: r(44, 164, 380, 80),
    text: 'Renseignez les champs.',
  },
  { id: 'champ-nom', tag: 'input', parentId: 'carte', base: r(44, 262, 380, 36), text: 'Nom' },
  { id: 'bouton-ok', tag: 'button', parentId: 'carte', base: r(44, 330, 120, 40), text: 'Valider' },
  {
    id: 'bouton-annuler',
    tag: 'button',
    parentId: 'carte',
    base: r(180, 330, 120, 40),
    text: 'Annuler',
  },
  { id: 'panneau', tag: 'aside', parentId: null, base: r(476, 96, 200, 300), text: '' },
  { id: 'image', tag: 'img', parentId: 'panneau', base: r(496, 116, 160, 160), text: 'image' },
  { id: 'legende', tag: 'p', parentId: 'panneau', base: r(496, 296, 160, 40), text: 'Légende' },
]

function r(x: number, y: number, width: number, height: number): Rect {
  return { x, y, width, height }
}

export interface MockRuntime extends RuntimeLink {
  /** Reproduit l'effet du CSS de surcouche généré par le plugin Vite. */
  setOverrides(doc: OverridesDoc): void
  /** Simule le code modifié par Claude : la géométrie devient celle de l'app, sans surcouche. */
  bake(items: readonly { id: string; geometry: Geometry }[]): void
}

export function createMockRuntime(
  host: HTMLElement,
  onMessage: (msg: RuntimeToDesigner) => void,
): MockRuntime {
  const root = document.createElement('div')
  root.className = 'mock-app'
  host.prepend(root)
  const nodes = new Map<string, HTMLElement>()
  for (const n of NODES) {
    const div = document.createElement('div')
    div.className = `mock-el mock-${n.tag}`
    div.textContent = n.text
    nodes.set(n.id, div)
    root.append(div)
  }

  let overrides: OverridesDoc['elements'] = {}
  const previews = new Map<string, Geometry>()
  const baked = new Map<string, Geometry>()
  const geometryOf = (id: string): Geometry =>
    previews.get(id) ?? overrides[id] ?? baked.get(id) ?? {}

  /** Rectangle visible : le `translate` d'un parent entraîne ses enfants, pas sa taille. */
  function measure(n: MockNode): Rect {
    let dx = 0
    let dy = 0
    for (let cur: MockNode | undefined = n; cur; cur = NODES.find(m => m.id === cur?.parentId)) {
      dx += geometryOf(cur.id).dx ?? 0
      dy += geometryOf(cur.id).dy ?? 0
    }
    const g = geometryOf(n.id)
    return r(n.base.x + dx, n.base.y + dy, g.width ?? n.base.width, g.height ?? n.base.height)
  }

  function refresh(): void {
    const elements: ElementInfo[] = NODES.map(n => ({
      id: n.id,
      tag: n.tag,
      parentId: n.parentId,
      rect: measure(n),
    }))
    for (const el of elements) {
      const style = nodes.get(el.id)?.style
      if (!style) continue
      style.left = `${el.rect.x}px`
      style.top = `${el.rect.y}px`
      style.width = `${el.rect.width}px`
      style.height = `${el.rect.height}px`
    }
    onMessage({
      type: 'runtime:elements',
      viewport: { width: host.clientWidth, height: host.clientHeight },
      elements,
    })
  }

  setTimeout(() => {
    onMessage({ type: 'runtime:hello', url: 'mock://app' })
    refresh()
  }, 0)

  return {
    send(msg: DesignerToRuntime) {
      if (msg.type === 'designer:preview') {
        if (msg.geometry === null) previews.delete(msg.id)
        else previews.set(msg.id, msg.geometry)
      }
      refresh()
    },
    setOverrides(doc) {
      overrides = doc.elements
      refresh()
    },
    bake(items) {
      for (const it of items) baked.set(it.id, it.geometry)
    },
    dispose() {
      root.remove()
    },
  }
}
