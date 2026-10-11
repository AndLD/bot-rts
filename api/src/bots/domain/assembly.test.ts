import { createModuleRegistry } from '../../modules/domain/module-registry'
import { MODULE_CATALOG } from '../../modules/domain/module-catalog'
import { validateAssembly } from './assembly'

const registry = createModuleRegistry()
const build = (...names: string[]) =>
  names.map((name) => {
    const template = MODULE_CATALOG.find((candidate) => candidate.name === name) as (typeof MODULE_CATALOG)[number]
    return registry.instantiate({ ...template, id: name, botId: 'bot' })
  })

const CORE = ['processor-class1', 'wireless-adapter-class1', 'battery-class1']

describe('validateAssembly', () => {
  it('accepts a stationary bot with the required modules', () => {
    expect(validateAssembly(build(...CORE))).toEqual({ ok: true, data: undefined })
    expect(validateAssembly(build(...CORE, 'scanner-class1', 'storage-class1'))).toMatchObject({ ok: true })
  })

  it('names the required modules that are missing', () => {
    expect(validateAssembly(build('processor-class1'))).toEqual({
      ok: false,
      code: 'NO_MODULE',
      msg: 'A bot needs a wireless adapter, a battery'
    })
    expect(validateAssembly([])).toMatchObject({ msg: 'A bot needs a processor, a wireless adapter, a battery' })
  })

  it('accepts a mobile bot with an engine and wheels that carry it', () => {
    expect(validateAssembly(build(...CORE, 'engine-class1', 'wheels-class1'))).toMatchObject({ ok: true })
  })

  it('rejects an engine without wheels, wheels without an engine and a bot too heavy for its wheels', () => {
    expect(validateAssembly(build(...CORE, 'engine-class1'))).toMatchObject({ code: 'NO_MODULE' })
    expect(validateAssembly(build(...CORE, 'wheels-class1'))).toMatchObject({ code: 'NO_MODULE' })
    const heavy = build(...CORE, 'engine-class1', 'wheels-class1', ...Array(5).fill('battery-class2'))
    expect(validateAssembly(heavy)).toMatchObject({ code: 'TOO_HEAVY' })
  })

  it('takes the movement balance into account', () => {
    expect(validateAssembly(build(...CORE, 'engine-class1', 'wheels-class1'), { maxTicksPerCell: 1 })).toMatchObject({
      ok: true
    })
  })
})
