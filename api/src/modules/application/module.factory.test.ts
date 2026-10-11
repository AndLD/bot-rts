import { SequentialIdGenerator } from '../../../tests/fakes/fakes'
import { MODULE_CATALOG, STARTER_KIT } from '../domain/module-catalog'
import { UnknownModuleError } from '../domain/module.errors'
import { ModuleFactory } from './module.factory'

describe('ModuleFactory', () => {
  it('creates a module of the catalog for a bot, with an id of its own', () => {
    const factory = new ModuleFactory(new SequentialIdGenerator())

    const [first, second] = [factory.create('scanner-class1', 'bot-1'), factory.create('scanner-class1', 'bot-1')]

    expect(first).toMatchObject({ botId: 'bot-1', type: 'scanner', name: 'scanner-class1', condition: 100 })
    expect(first.id).not.toBe(second.id)
  })

  it('does not share the properties between modules', () => {
    const factory = new ModuleFactory(new SequentialIdGenerator())
    const [a, b] = [factory.create('storage-class1', 'bot-1'), factory.create('storage-class1', 'bot-1')]

    ;(a.props.items as unknown[]).push('oil')

    expect(b.props.items).toEqual([])
    expect(MODULE_CATALOG.find((t) => t.name === 'storage-class1')?.props.items).toEqual([])
  })

  it('refuses an unknown module', () => {
    expect(() => new ModuleFactory(new SequentialIdGenerator()).create('warp-drive', 'bot-1')).toThrow(
      UnknownModuleError
    )
  })

  it('builds the starter kit of a base', () => {
    const kit = new ModuleFactory(new SequentialIdGenerator()).starterKit('base-1')

    expect(kit.map((module) => module.name)).toEqual(STARTER_KIT)
    expect(kit.every((module) => module.botId === 'base-1')).toBe(true)
  })

  it('takes a catalog of its own', () => {
    const template = { ...MODULE_CATALOG[0], name: 'custom' }

    expect(new ModuleFactory(new SequentialIdGenerator(), [template]).create('custom', 'b').name).toBe('custom')
  })
})
