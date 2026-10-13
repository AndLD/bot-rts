import { SequentialIdGenerator } from '../../../tests/fakes/fakes'
import { ModuleFactory } from '../application/module.factory'
import { EnergyModel } from './energy-model'
import { Module } from './module.entity'
import { createModuleRegistry } from './module-registry'

// The contract of design §24.1: an event is an edge, never a level. A bot is run through many ticks in a bad state that
// does not change, and no event type may fire more than once (the records are fed back each tick, as the engine keeps them).
const TICKS = 300
const TICK_MS = 100

const model = new EnergyModel(createModuleRegistry())
const factory = new ModuleFactory(new SequentialIdGenerator())

function bot(overrides: Record<string, Record<string, unknown>>, names: string[]): Module[] {
  return names.map((name) => {
    const module = factory.create(name, 'bot')
    return { ...module, props: { ...module.props, ...overrides[name] } }
  })
}

function eventsOverTicks(initial: Module[]): Record<string, number> {
  const counts: Record<string, number> = {}
  let records = initial
  for (let tick = 1; tick <= TICKS; tick++) {
    const { modules, events } = model.tick(records, tick * TICK_MS)
    records = records.map((record) => modules.find((changed) => changed.id === record.id) ?? record)
    events.forEach((event) => (counts[event.type] = (counts[event.type] ?? 0) + 1))
  }
  return counts
}

const BASIC = ['battery-class1', 'generator-class1', 'storage-class1', 'scanner-class1', 'processor-class1']

describe('energy events are edges, not levels', () => {
  const scenarios: Array<[string, Module[]]> = [
    [
      'a generator without oil and a draining battery',
      bot({ 'battery-class1': { capacity: 100, value: 50 }, 'storage-class1': { items: [] } }, BASIC)
    ],
    [
      'a low battery with the generator off',
      bot({ 'battery-class1': { capacity: 100, value: 5 }, 'generator-class1': { isEnabled: false } }, BASIC)
    ],
    [
      'a live scanner that the empty battery cannot pay',
      bot(
        {
          'battery-class1': { capacity: 100, value: 1 },
          'generator-class1': { isEnabled: false },
          'scanner-class1': { isLive: true }
        },
        BASIC
      )
    ],
    ['an empty battery', bot({ 'battery-class1': { value: 0 }, 'generator-class1': { isEnabled: false } }, BASIC)]
  ]

  it.each(scenarios)('tells nothing twice for %s', (_name, records) => {
    const counts = eventsOverTicks(records)

    Object.entries(counts).forEach(([, count]) => expect(count).toBeLessThanOrEqual(1))
  })
})
