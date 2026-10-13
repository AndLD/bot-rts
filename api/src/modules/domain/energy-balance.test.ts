import { DEFAULT_GAME_TIME } from '../../../../lib/utils/game-time'
import { SequentialIdGenerator } from '../../../tests/fakes/fakes'
import { ModuleFactory } from '../application/module.factory'
import { EnergyModel } from './energy-model'
import { MODULE_CATALOG, STARTER_KIT } from './module-catalog'
import { Module } from './module.entity'
import { createModuleRegistry } from './module-registry'

// The balance rules of design §7.2.1 over a whole game day. A tweak of the catalogue numbers that breaks the economy of
// the starter base fails here.
const TICK_MS = 100
const TICKS_PER_DAY = DEFAULT_GAME_TIME.dayLengthMs / TICK_MS
const TICKS_PER_SECOND = 1000 / TICK_MS

const model = new EnergyModel(createModuleRegistry())
const factory = new ModuleFactory(new SequentialIdGenerator())
const template = (name: string) => MODULE_CATALOG.find((candidate) => candidate.name === name)!

const starterBase = () =>
  STARTER_KIT.map((name) => {
    const module = factory.create(name, 'base')
    return module.type === 'solarPanel' || module.type === 'generator'
      ? { ...module, props: { ...module.props, lastCycleAt: 0 } }
      : module
  })

// What a duty costs per second, from the operation costs of the catalogue
const SCAN_ENERGY = template('scanner-class1').operationCost * 9
const CRAFT_ENERGY = template('factory-class1').operationCost
const LIGHT_DUTY: Array<{ everySeconds: number; energy: number }> = [
  // a look around every 20 s, a craft or an assembly every 4 game minutes
  { everySeconds: 20, energy: SCAN_ENERGY },
  { everySeconds: 240, energy: CRAFT_ENERGY }
]
// mining 4 times a second, driving 4 cells a second, a shot every 2 s
const HEAVY_PER_SECOND =
  4 * template('drill-class1').operationCost +
  4 * template('engine-class1').operationCost +
  template('gun-class1').operationCost / 2

interface DayResult {
  minimum: number
  endsWith: number
  firstEmptyAtSeconds: number | undefined
}

function simulate(days: number, spendAt: (tick: number) => number, records: Module[] = starterBase()): DayResult {
  let current = records
  let minimum = Infinity
  let firstEmptyAtSeconds: number | undefined
  for (let tick = 1; tick <= days * TICKS_PER_DAY; tick++) {
    const { modules } = model.tick(current, tick * TICK_MS)
    current = current.map((record) => modules.find((changed) => changed.id === record.id) ?? record)
    const spend = spendAt(tick)
    if (spend > 0) {
      const paid = model.spend(current, spend)
      if (paid.ok) {
        current = paid.data.reduce((all, changed) => all.map((r) => (r.id === changed.id ? changed : r)), current)
      } else if (firstEmptyAtSeconds === undefined) {
        firstEmptyAtSeconds = (tick * TICK_MS) / 1000
      }
    }
    minimum = Math.min(minimum, model.stored(current))
  }
  return { minimum, endsWith: model.stored(current), firstEmptyAtSeconds }
}

describe('the energy balance of the starter base', () => {
  it('starts on a solar panel and no oil generator, with oil left in the storage', () => {
    expect(STARTER_KIT).toContain('solar-panel-class1')
    expect(STARTER_KIT).not.toContain('generator-class1')
    expect(template('storage-class1').props.items).toEqual([{ resource: 'oil', amount: 50 }])
  })

  it('lives on its solar panel alone through the nights under a light duty, day after day', () => {
    const lightDuty = (tick: number) =>
      LIGHT_DUTY.reduce(
        (sum, { everySeconds, energy }) => (tick % (everySeconds * TICKS_PER_SECOND) === 0 ? sum + energy : sum),
        0
      )

    const result = simulate(3, lightDuty)

    expect(result.firstEmptyAtSeconds).toBeUndefined()
    expect(result.minimum).toBeGreaterThan(300)
    expect(result.endsWith).toBeGreaterThan(1500)
  })

  it('idles through a whole day on the panel without help', () => {
    const result = simulate(3, () => 0)

    expect(result.minimum).toBeGreaterThan(1000)
  })

  it('runs out of energy under a continuous heavy duty, however much sun there is', () => {
    const heavy = () => HEAVY_PER_SECOND / TICKS_PER_SECOND

    const result = simulate(1, heavy)

    expect(result.firstEmptyAtSeconds).toBeDefined()
    expect(result.firstEmptyAtSeconds).toBeLessThan(300)
    // more than the panel makes at its peak, so even noon does not save it
    expect(HEAVY_PER_SECOND).toBeGreaterThan(peakPerSecond('solar-panel-class1'))
  })

  it('makes the oil generator at least five times stronger than the panel at its peak', () => {
    expect(peakPerSecond('generator-class1')).toBeGreaterThanOrEqual(5 * peakPerSecond('solar-panel-class1'))
    expect(template('generator-class1').props.fuelPerCycle).toBeGreaterThan(0)
    expect(template('solar-panel-class1').props.fuelPerCycle).toBeUndefined()
  })
})

function peakPerSecond(name: string): number {
  const { delay, energyPerCycle } = template(name).props as { delay: number; energyPerCycle: number }
  return (energyPerCycle * 1000) / delay
}
