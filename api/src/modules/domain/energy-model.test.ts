import { RESOURCE } from '../../../../lib/utils/interfaces/resources'
import { SequentialIdGenerator } from '../../../tests/fakes/fakes'
import { ModuleFactory } from '../application/module.factory'
import { BatteryModule, GeneratorModule, StorageModule } from './game-module'
import { DEFAULT_ENERGY_BALANCE, ENERGY_EVENT, EnergyModel } from './energy-model'
import { Module } from './module.entity'
import { createModuleRegistry } from './module-registry'
import { ScannerModule } from './scanner-module'

const registry = createModuleRegistry()
const model = new EnergyModel(registry)
const factory = new ModuleFactory(new SequentialIdGenerator())

function bot(overrides: Record<string, Record<string, unknown>> = {}, names?: string[]): Module[] {
  return (names ?? ['battery-class1', 'generator-class1', 'storage-class1', 'scanner-class1', 'processor-class1']).map(
    (name) => {
      const module = factory.create(name, 'bot')
      return { ...module, props: { ...module.props, ...overrides[name] } }
    }
  )
}

const find = <T>(records: Module[], type: Module['type'], moduleClass: new (r: Module) => T): T =>
  new moduleClass(records.find((m) => m.type === type) as Module)

describe('EnergyModel', () => {
  it('knows how much energy a bot has, and when it is depleted', () => {
    const records = bot({ 'battery-class1': { capacity: 100, value: 40 } })

    expect(model.stored(records)).toBe(40)
    expect(model.capacity(records)).toBe(100)
    expect(model.isDepleted(records)).toBe(false)
    expect(model.isDepleted(bot({ 'battery-class1': { value: 0 } }))).toBe(true)
    expect(model.isDepleted(bot({}, ['processor-class1']))).toBe(true)
  })

  it('counts only the batteries that work and are connected', () => {
    const [battery] = bot({ 'battery-class1': { value: 100 } })

    expect(model.stored([{ ...battery, condition: 0 }])).toBe(0)
    expect(model.stored([{ ...battery, props: { ...battery.props, isConnected: false } }])).toBe(0)
  })

  it('pays for an operation out of the battery and refuses when there is not enough', () => {
    const records = bot({ 'battery-class1': { capacity: 100, value: 40 } })

    const paid = model.spend(records, 15)
    expect(paid.ok && model.stored(paid.data)).toBe(25)
    expect(model.spend(records, 41)).toMatchObject({ ok: false, code: 'NO_ENERGY' })
    expect(model.stored(records)).toBe(40)
  })

  it('takes energy from several batteries in turn', () => {
    const [first] = bot({ 'battery-class1': { capacity: 100, value: 10 } })
    const second = { ...first, id: 'second', props: { ...first.props, value: 30 } }

    const paid = model.spend([first, second], 25)

    expect(paid.ok && paid.data.map((m) => m.props.value)).toEqual([0, 15])
  })

  it('drains the idle cost of the working modules every tick', () => {
    const records = bot({ 'battery-class1': { capacity: 3000, value: 1000 }, 'generator-class1': { isEnabled: false } })

    const { modules, events } = model.tick(records, 0)

    // scanner 0.05 + processor 0.05
    expect(model.stored([...modules, ...records.filter((r) => !modules.some((m) => m.id === r.id))])).toBeCloseTo(999.9)
    expect(events).toEqual([])
  })

  it('does not drain the idle cost of a broken module', () => {
    const records = bot({ 'generator-class1': { isEnabled: false } }).map((m) =>
      m.type === 'battery' ? m : { ...m, condition: 0 }
    )

    expect(model.tick(records, 0).modules).toEqual([])
  })

  it('stops at zero when the idle drain is more than is left', () => {
    const records = bot({ 'battery-class1': { value: 0.01 }, 'generator-class1': { isEnabled: false } })

    const { modules, events } = model.tick(records, 0)

    expect(find(modules, 'battery', BatteryModule).value).toBe(0)
    expect(events).toEqual([{ type: ENERGY_EVENT.LOW }])
  })

  it('refills the battery from the generator, burning oil for every cycle', () => {
    const records = bot({ 'battery-class1': { capacity: 100, value: 10 }, 'generator-class1': { lastCycleAt: 0 } })

    const { modules, events } = model.tick(records, 1000)

    // 1000 ms / 250 ms = 4 cycles of 12 energy for 0.02 oil
    expect(find(modules, 'battery', BatteryModule).value).toBeCloseTo(10 - 0.1 + 48)
    expect(find(modules, 'storage', StorageModule).amountOf(RESOURCE.OIL)).toBeCloseTo(50 - 0.08)
    expect(find(modules, 'generator', GeneratorModule).lastCycleAt).toBe(1000)
    expect(events).toEqual([])
  })

  it('starts counting cycles when it first runs, and keeps the remainder of a cycle', () => {
    const fresh = bot({ 'battery-class1': { capacity: 100, value: 10 } })
    const first = model.tick(fresh, 5000)
    expect(find(first.modules, 'generator', GeneratorModule).lastCycleAt).toBe(5000)
    expect(find(first.modules, 'battery', BatteryModule).value).toBeCloseTo(9.9)

    const running = bot({ 'battery-class1': { capacity: 100, value: 10 }, 'generator-class1': { lastCycleAt: 0 } })
    expect(find(model.tick(running, 600).modules, 'generator', GeneratorModule).lastCycleAt).toBe(500)
  })

  it('does not burn oil for energy the battery has no room for', () => {
    const records = bot({ 'battery-class1': { capacity: 100, value: 90 }, 'generator-class1': { lastCycleAt: 0 } })

    const { modules } = model.tick(records, 10_000)

    // 89.9 after the idle drain: one cycle fills the battery, the other nine due cycles burn nothing
    expect(find(modules, 'battery', BatteryModule).value).toBe(100)
    expect(find(modules, 'storage', StorageModule).amountOf(RESOURCE.OIL)).toBeCloseTo(50 - 0.02)
  })

  it('stops without oil and says so', () => {
    const records = bot({
      'battery-class1': { capacity: 100, value: 10 },
      'generator-class1': { lastCycleAt: 0 },
      'storage-class1': { items: [{ resource: 'oil', amount: 0.03 }] }
    })

    const { modules, events } = model.tick(records, 1000)

    // fuel for one cycle only
    expect(find(modules, 'battery', BatteryModule).value).toBeCloseTo(10 - 0.1 + 12)
    expect(events).toContainEqual({ type: ENERGY_EVENT.OUT_OF_FUEL, moduleId: expect.any(String) })

    const dry = bot({ 'generator-class1': { lastCycleAt: 0 }, 'storage-class1': { items: [] } })
    expect(model.tick(dry, 1000).events).toContainEqual({
      type: ENERGY_EVENT.OUT_OF_FUEL,
      moduleId: expect.any(String)
    })
  })

  it('burns the oil of several storages in turn and ignores the oil of a broken one', () => {
    const [battery, generator, storage] = bot({
      'battery-class1': { capacity: 100, value: 0 },
      'generator-class1': { lastCycleAt: 0 },
      'storage-class1': { items: [{ resource: 'oil', amount: 0.02 }] }
    })
    const second = { ...storage, id: 'second', props: { ...storage.props, items: [{ resource: 'oil', amount: 5 }] } }
    const broken = {
      ...storage,
      id: 'broken',
      condition: 0,
      props: { ...storage.props, items: [{ resource: 'oil', amount: 99 }] }
    }

    const { modules } = model.tick([battery, generator, storage, second, broken], 1000)

    const left = (id: string) =>
      new StorageModule(
        modules.find((m) => m.id === id) ?? ([storage, second, broken].find((m) => m.id === id) as Module)
      ).amountOf(RESOURCE.OIL)
    expect(left(storage.id)).toBe(0)
    expect(left('second')).toBeCloseTo(5 - 0.06)
    expect(left('broken')).toBe(99)
  })

  it('leaves a disabled or broken generator alone', () => {
    const disabled = bot({ 'battery-class1': { value: 10 }, 'generator-class1': { isEnabled: false } })
    expect(find(model.tick(disabled, 1000).modules, 'battery', BatteryModule).value).toBeCloseTo(9.9)

    const broken = bot({ 'battery-class1': { value: 10 } }).map((m) =>
      m.type === 'generator' ? { ...m, condition: 0 } : m
    )
    expect(find(model.tick(broken, 1000).modules, 'battery', BatteryModule).value).toBeCloseTo(9.9)
  })

  it('runs one cycle per tick for a generator without a delay, and makes nothing without output', () => {
    const noDelay = bot({
      'battery-class1': { capacity: 100, value: 10 },
      'generator-class1': { delay: 0, lastCycleAt: 0 }
    })
    expect(find(model.tick(noDelay, 7).modules, 'battery', BatteryModule).value).toBeCloseTo(10 - 0.1 + 12)

    const weak = bot({
      'battery-class1': { capacity: 100, value: 10 },
      'generator-class1': { energyPerCycle: 0, lastCycleAt: 0 }
    })
    expect(find(model.tick(weak, 1000).modules, 'battery', BatteryModule).value).toBeCloseTo(9.9)

    const fuelless = bot({
      'battery-class1': { capacity: 100, value: 10 },
      'generator-class1': { fuelPerCycle: 0, lastCycleAt: 0 },
      'storage-class1': { items: [] }
    })
    expect(find(model.tick(fuelless, 1000).modules, 'battery', BatteryModule).value).toBeCloseTo(10 - 0.1 + 48)
  })

  it('pays a live scanner for refreshing its area every tick', () => {
    const records = bot({
      'battery-class1': { capacity: 200, value: 100 },
      'generator-class1': { isEnabled: false },
      'scanner-class1': { isLive: true }
    })

    const { modules, events } = model.tick(records, 0)

    // area 9 → 9 energy, plus the idle cost
    expect(find(modules, 'battery', BatteryModule).value).toBeCloseTo(100 - 0.1 - 9)
    expect(modules.some((m) => m.type === 'scanner')).toBe(false)
    expect(events).toEqual([])
  })

  it('switches a live scanner off when the battery cannot pay for a refresh', () => {
    const records = bot({
      'battery-class1': { capacity: 3000, value: 5 },
      'generator-class1': { isEnabled: false },
      'scanner-class1': { isLive: true }
    })

    const { modules, events } = model.tick(records, 0)

    expect(find(modules, 'scanner', ScannerModule).isLive).toBe(false)
    expect(events).toContainEqual({ type: ENERGY_EVENT.LIVE_SCAN_STOPPED, moduleId: expect.any(String) })
  })

  it('tells a bot its energy is low', () => {
    const records = bot({
      'battery-class1': { capacity: 100, value: 9 },
      'generator-class1': { isEnabled: false }
    })

    expect(model.tick(records, 0).events).toEqual([{ type: ENERGY_EVENT.LOW }])
    expect(new EnergyModel(registry, { lowThreshold: 0.05 }).tick(records, 0).events).toEqual([])
    expect(DEFAULT_ENERGY_BALANCE.lowThreshold).toBe(0.1)
  })

  it('drains several ticks at once', () => {
    const records = bot({ 'battery-class1': { capacity: 3000, value: 100 }, 'generator-class1': { isEnabled: false } })

    expect(find(model.tick(records, 0, 10).modules, 'battery', BatteryModule).value).toBeCloseTo(99)
  })
})
