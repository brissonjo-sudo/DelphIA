import { describe, expect, it } from 'vitest'

import { DEFAULT_APP_PORT, DEFAULT_BRIDGE_PORT, parseConfig } from '../src/index.js'

describe('parseConfig', () => {
  it('applique les valeurs par défaut', () => {
    expect(parseConfig({})).toEqual({
      ok: true,
      value: { port: DEFAULT_BRIDGE_PORT, appPort: DEFAULT_APP_PORT },
    })
  })

  it('accepte des ports explicites et $schema', () => {
    expect(parseConfig({ $schema: 'x', port: 5000, appPort: 5173 })).toMatchObject({
      ok: true,
      value: { port: 5000, appPort: 5173 },
    })
  })

  it.each([[{ port: 80 }], [{ appPort: '1420' }], [{ port: 1420 }], [{ evil: true }], [null]])(
    'refuse %j',
    input => expect(parseConfig(input).ok).toBe(false),
  )
})
