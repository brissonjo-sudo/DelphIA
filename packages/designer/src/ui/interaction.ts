import type { Geometry, Rect } from '@vite-plugin-delph-ia/protocol'
import type { Actions } from '../actions.js'
import { computeDrag } from '../core/drag.js'
import { hitTest, snapTargets } from '../core/elements.js'
import type { DragMode, Handle } from '../core/geometry.js'
import { HANDLES, pickGeometry } from '../core/geometry.js'
import { keyStep } from '../core/keyboard.js'
import type { Store } from '../state.js'

interface Session {
  id: string
  mode: DragMode
  startX: number
  startY: number
  startRect: Rect
  startGeometry: Geometry
  targets: Rect[]
  previewed: boolean
  lastKey: string
}

const isHandle = (v: string | undefined): v is Handle => HANDLES.includes(v as Handle)
const isTyping = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)

/** Souris et clavier sur le calque : sélection, déplacement, redimensionnement, flèches. */
export function attachInteraction(overlay: HTMLElement, store: Store, actions: Actions): void {
  let session: Session | null = null

  const point = (e: MouseEvent): { x: number; y: number } => {
    const b = overlay.getBoundingClientRect()
    return { x: e.clientX - b.left, y: e.clientY - b.top }
  }

  function begin(e: MouseEvent): void {
    if (e.button !== 0) return
    const s = store.get()
    const p = point(e)
    const handle = (e.target as HTMLElement).dataset.handle
    let id = s.selectedId
    let mode: DragMode = 'move'
    if (e.shiftKey && !isHandle(handle)) {
      // Maj+clic : ajoute ou retire de la sélection, sans glisser.
      const hit = hitTest(s.elements, p.x, p.y)
      if (hit) actions.toggleSelect(hit.id)
      e.preventDefault()
      return
    }
    if (isHandle(handle) && id) mode = handle
    else {
      id = hitTest(s.elements, p.x, p.y)?.id ?? null
      actions.select(id)
    }
    const el = s.elements.find(x => x.id === id)
    if (!id || !el) return
    e.preventDefault()
    session = {
      id,
      mode,
      startX: p.x,
      startY: p.y,
      startRect: el.rect,
      startGeometry: pickGeometry(s.overrides.elements[id]),
      targets: snapTargets(s.elements, id),
      previewed: false,
      lastKey: '',
    }
  }

  function move(e: MouseEvent): void {
    const s = store.get()
    if (!session) {
      const p = point(e)
      const hover = e.target === overlay ? (hitTest(s.elements, p.x, p.y)?.id ?? null) : s.hoverId
      if (hover !== s.hoverId) store.set({ hoverId: hover })
      return
    }
    const p = point(e)
    const r = computeDrag({
      mode: session.mode,
      startRect: session.startRect,
      startGeometry: session.startGeometry,
      dx: p.x - session.startX,
      dy: p.y - session.startY,
      targets: session.targets,
      snap: s.snapOn,
      grid: s.gridOn,
    })
    store.set({ ghost: { id: session.id, rect: r.rect, geometry: r.geometry }, guides: r.guides })
    const key = JSON.stringify(r.geometry)
    if (key === session.lastKey) return
    session.lastKey = key
    session.previewed = true
    actions.preview(session.id, r.geometry)
  }

  function end(e: MouseEvent): void {
    if (!session) return
    const s = store.get()
    const done = session
    session = null
    const p = point(e)
    const r = computeDrag({
      mode: done.mode,
      startRect: done.startRect,
      startGeometry: done.startGeometry,
      dx: p.x - done.startX,
      dy: p.y - done.startY,
      targets: done.targets,
      snap: s.snapOn,
      grid: s.gridOn,
    })
    store.set({ ghost: null, guides: [] })
    if (r.changed) actions.commit(done.id, r.patch)
    else if (done.previewed) actions.preview(done.id, null)
  }

  overlay.addEventListener('mousedown', begin)
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', e => end(e))
  overlay.addEventListener('mouseleave', () => {
    if (!session && store.get().hoverId !== null) store.set({ hoverId: null })
  })

  document.addEventListener('keydown', e => {
    if (isTyping(e.target)) return
    if (e.key === 'Escape') {
      if (session) {
        const d = session
        session = null
        store.set({ ghost: null, guides: [] })
        if (d.previewed) actions.preview(d.id, null)
      } else actions.select(null)
      return
    }
    const step = keyStep(e.key, e.shiftKey)
    const s = store.get()
    if (!step || !s.selectedId || session) return
    const cur = s.overrides.elements[s.selectedId]
    e.preventDefault()
    actions.commit(s.selectedId, { dx: (cur?.dx ?? 0) + step.dx, dy: (cur?.dy ?? 0) + step.dy })
  })
}
