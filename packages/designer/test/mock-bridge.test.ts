import type { BridgeToClient, OverridesDoc } from '@vite-plugin-delph-ia/protocol'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockBridge } from '../src/io/mock-bridge-client.js'

const doc: OverridesDoc = {
  version: 1,
  revision: 1,
  elements: { a: { dx: 8, updatedAt: '2026-10-24T08:00:00.000Z' } },
}
const target = { x: 8, y: 0, width: 10, height: 10 }

describe('faux pont : cycle de figeage', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function setup() {
    const msgs: BridgeToClient[] = []
    const mb = createMockBridge({ onMessage: m => msgs.push(m), onStatus() {} }, doc, 1500)
    vi.advanceTimersByTime(0)
    return { mb, msgs }
  }
  const lastBake = (msgs: BridgeToClient[]) => {
    const m = msgs.filter(x => x.type === 'bake:state').at(-1)
    return m?.type === 'bake:state' ? m.bake : undefined
  }

  it('request, applied (surcouche vidée), verify, verified', () => {
    const { mb, msgs } = setup()
    mb.send({ type: 'bake:request', items: [{ id: 'a', target }] })
    const id = lastBake(msgs)?.current?.bakeId as string
    expect(lastBake(msgs)?.current?.status).toBe('requested')
    vi.advanceTimersByTime(1500)
    expect(lastBake(msgs)?.current?.status).toBe('applied')
    expect(mb.doc().elements.a).toBeUndefined()
    mb.send({
      type: 'bake:verify',
      bakeId: id,
      results: [{ id: 'a', actual: { ...target, x: 8.5 } }],
    })
    expect(lastBake(msgs)?.current).toBeNull()
    expect(lastBake(msgs)?.history[0]?.status).toBe('verified')
  })

  it('mesure hors tolérance : mismatch, puis rétablir remet la surcouche', () => {
    const { mb, msgs } = setup()
    mb.send({ type: 'bake:request', items: [{ id: 'a', target }] })
    const id = lastBake(msgs)?.current?.bakeId as string
    vi.advanceTimersByTime(1500)
    mb.send({ type: 'bake:verify', bakeId: id, results: [{ id: 'a', actual: null }] })
    expect(lastBake(msgs)?.history[0]?.status).toBe('mismatch')
    mb.send({ type: 'bake:revert', bakeId: id })
    expect(lastBake(msgs)?.history[0]?.status).toBe('reverted')
    expect(mb.doc().elements.a?.dx).toBe(8)
  })

  it('annulation avant application ; refus si demande ouverte ou id non épinglé', () => {
    const { mb, msgs } = setup()
    mb.send({ type: 'bake:request', items: [{ id: 'zz', target }] })
    expect(msgs.at(-1)?.type).toBe('bridge:error')
    mb.send({ type: 'bake:request', items: [{ id: 'a', target }] })
    mb.send({ type: 'bake:request', items: [{ id: 'a', target }] })
    expect(msgs.at(-1)?.type).toBe('bridge:error')
    mb.send({ type: 'bake:cancel', bakeId: lastBake(msgs)?.current?.bakeId as string })
    vi.advanceTimersByTime(3000)
    expect(lastBake(msgs)?.history[0]?.status).toBe('cancelled')
    expect(mb.doc().elements.a).toBeDefined()
  })
})
