import { buildModule } from '../../../tests/integration/builders'
import { createModuleRegistry } from '../../modules/domain/module-registry'
import { isCorpse } from './base-state'

const registry = createModuleRegistry()
const modules = (...records: ReturnType<typeof buildModule>[]) => registry.instantiateAll(records)
const adapter = (condition = 100) => buildModule('base', { type: 'wirelessAdapter', condition })

describe('isCorpse', () => {
  it('is alive while a wireless adapter works', () => {
    expect(isCorpse(modules(adapter(), buildModule('base', { type: 'scanner' })))).toBe(false)
  })

  it('is a corpse without modules, without an adapter, or with a broken one', () => {
    expect(isCorpse(modules())).toBe(true)
    expect(isCorpse(modules(buildModule('base', { type: 'processor' })))).toBe(true)
    expect(isCorpse(modules(adapter(0)))).toBe(true)
  })

  it('is alive again when the adapter is repaired, even if a second adapter is broken', () => {
    expect(isCorpse(modules(adapter(0), adapter(30)))).toBe(false)
  })

  it('does not depend on a broken processor alone: that only cripples the base', () => {
    expect(isCorpse(modules(adapter(), buildModule('base', { type: 'processor', condition: 0 })))).toBe(false)
  })
})
