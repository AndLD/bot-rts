import { MODULE_TYPES } from '../../../../lib/utils/interfaces/modules'
import { buildModule } from '../../../tests/integration/builders'
import { DriveModule, GameModule, GpsModule, ScannerModule } from './game-module'
import { MODULE_CATALOG, STARTER_KIT } from './module-catalog'
import { UnknownModuleTypeError } from './module.errors'
import { createModuleRegistry, ModuleRegistry } from './module-registry'

describe('the module registry', () => {
  const registry = createModuleRegistry()

  it('has a class for every module type', () => {
    for (const type of MODULE_TYPES) {
      expect(registry.instantiate(buildModule('bot', { type }))).toBeInstanceOf(GameModule)
    }
  })

  it('gives each type its own class', () => {
    expect(registry.instantiate(buildModule('bot', { type: 'scanner' }))).toBeInstanceOf(ScannerModule)
    expect(registry.instantiate(buildModule('bot', { type: 'drive' }))).toBeInstanceOf(DriveModule)
    expect(registry.instantiate(buildModule('bot', { type: 'gps' }))).toBeInstanceOf(GpsModule)
  })

  it('refuses a type nobody registered', () => {
    expect(() => new ModuleRegistry().instantiate(buildModule('bot'))).toThrow(UnknownModuleTypeError)
  })

  it('picks the modules of one class out of a list', () => {
    const records = [buildModule('bot', { type: 'scanner' }), buildModule('bot', { type: 'drive' })]

    expect(registry.instancesOf(records, DriveModule).map((m) => m.id)).toEqual([records[1].id])
    expect(registry.instancesOf(records, ScannerModule)).toHaveLength(1)
  })
})

describe('the module catalog', () => {
  const registry = createModuleRegistry()

  it('holds working modules of registered types with unique names', () => {
    const names = MODULE_CATALOG.map((template) => template.name)

    expect(new Set(names).size).toBe(names.length)
    for (const template of MODULE_CATALOG) {
      expect(registry.instantiate({ ...template, id: 'm', botId: 'b' }).isWorking).toBe(true)
    }
  })

  it('has every module of the starter kit, which carries the processor, memory and wireless adapter (design §6.1)', () => {
    const names = MODULE_CATALOG.map((template) => template.name)

    expect(STARTER_KIT.every((name) => names.includes(name))).toBe(true)
    expect(STARTER_KIT).toEqual(
      expect.arrayContaining(['processor-class1', 'memory-class1', 'wireless-adapter-class1'])
    )
  })
})
