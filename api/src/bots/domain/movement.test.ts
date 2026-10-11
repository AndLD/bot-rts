import { buildModule } from '../../../tests/integration/builders'
import { EngineModule, GameModule, MovementModule, StorageModule } from '../../modules/domain/game-module'
import { DEFAULT_MOVEMENT_BALANCE, movementOf, totalWeight } from './movement'

const engine = (speed: number, overrides = {}) =>
  new EngineModule(buildModule('bot', { type: 'engine', weight: 40, props: { speed }, ...overrides }))
const wheels = (loadCapacity: number, overrides = {}) =>
  new MovementModule(buildModule('bot', { type: 'movement', weight: 25, props: { loadCapacity }, ...overrides }))
const cargo = (weight: number): GameModule =>
  new StorageModule(buildModule('bot', { type: 'storage', weight, props: { capacity: 10 } }))

describe('totalWeight', () => {
  it('adds up everything attached, broken modules included', () => {
    expect(totalWeight([engine(50), wheels(400, { condition: 0 }), cargo(10)])).toBe(75)
    expect(totalWeight([])).toBe(0)
  })
})

describe('movementOf', () => {
  it('moves a bot with an engine and wheels that carry it, faster the stronger the engine', () => {
    expect(movementOf([engine(50), wheels(400), cargo(135)])).toEqual({
      ok: true,
      data: { totalWeight: 200, ticksPerCell: 4 }
    })
    expect(movementOf([engine(200), wheels(400), cargo(135)])).toMatchObject({ data: { ticksPerCell: 1 } })
    expect(movementOf([engine(50), engine(50), wheels(400), cargo(35)])).toMatchObject({
      data: { totalWeight: 140, ticksPerCell: 2 }
    })
  })

  it('never takes longer than the maximum, and never less than one tick', () => {
    expect(movementOf([engine(1), wheels(400)])).toMatchObject({ data: { ticksPerCell: 20 } })
    expect(movementOf([engine(1), wheels(400)], { maxTicksPerCell: 5 })).toMatchObject({ data: { ticksPerCell: 5 } })
    expect(movementOf([engine(10_000), wheels(400)])).toMatchObject({ data: { ticksPerCell: 1 } })
    expect(DEFAULT_MOVEMENT_BALANCE.maxTicksPerCell).toBe(20)
  })

  it('needs an engine and a chassis', () => {
    expect(movementOf([wheels(400)])).toMatchObject({ ok: false, code: 'NO_MODULE' })
    expect(movementOf([engine(50)])).toMatchObject({ ok: false, code: 'NO_MODULE' })
    expect(movementOf([])).toMatchObject({ ok: false, code: 'NO_MODULE' })
  })

  it('does not move with a broken engine or chassis, nor with an engine that has no power', () => {
    expect(movementOf([engine(50, { condition: 0 }), wheels(400)])).toMatchObject({ code: 'BROKEN_MODULE' })
    expect(movementOf([engine(50), wheels(400, { condition: 0 })])).toMatchObject({ code: 'BROKEN_MODULE' })
    expect(movementOf([engine(50, { condition: 0 }), engine(50), wheels(400)])).toMatchObject({ ok: true })
    expect(movementOf([engine(0), wheels(400)])).toMatchObject({ code: 'TOO_LOW' })
  })

  it('does not move a bot heavier than its chassis can carry', () => {
    expect(movementOf([engine(50), wheels(100), cargo(100)])).toMatchObject({ ok: false, code: 'TOO_HEAVY' })
    expect(movementOf([engine(50), wheels(165), cargo(100)])).toMatchObject({ ok: true })
  })
})
