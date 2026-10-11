import { buildModule } from '../../../tests/integration/builders'
import { distanceBetween, WeaponModule } from './weapon-module'

const gun = (props: Record<string, unknown> = {}, overrides = {}) =>
  new WeaponModule(
    buildModule('bot', {
      type: 'weapon',
      operationCost: 5,
      props: { damage: 50, distance: 5, accuracy: 0.5, cooldown: 2000, magazine: 10, loaded: 10, ...props },
      ...overrides
    })
  )

const here = { x: 0, y: 0 }
const request = (target = { x: 3, y: 1 }, o = {}) => ({ from: here, target, now: 10_000, energy: 100, ...o })

describe('WeaponModule', () => {
  it('measures distance as the larger of the two axes', () => {
    expect(distanceBetween(here, { x: 3, y: -4 })).toBe(4)
  })

  it('reads its properties with fallbacks', () => {
    expect(gun({ caliber: 25, batchSize: 3, batchCooldown: 500, isArtillery: true })).toMatchObject({
      caliber: 25,
      batchSize: 3,
      batchCooldown: 500,
      isArtillery: true,
      cooldown: 2000,
      loaded: 10
    })
    expect(gun({ batchSize: 0 }).batchSize).toBe(1)
    expect(gun({}).batchCooldown).toBe(2000)
    expect(gun({ accuracy: 4 }).accuracy).toBe(1)
    expect(gun({ loaded: 50 }).loaded).toBe(10)
    expect(gun({ isArtillery: undefined }).isArtillery).toBe(false)
  })

  it('aims only at a cell within reach', () => {
    expect(gun().aim(here, { x: 3, y: 1 })).toEqual({ ok: true, data: 3 })
    expect(gun().aim(here, { x: 6, y: 0 })).toMatchObject({ code: 'OUT_OF_RANGE' })
    expect(gun().aim(here, here)).toMatchObject({ code: 'OUT_OF_RANGE' })
    expect(gun({}, { condition: 0 }).aim(here, { x: 1, y: 0 })).toMatchObject({ code: 'BROKEN_MODULE' })
  })

  it('loses accuracy with distance', () => {
    expect(gun().hitChance(0)).toBe(0.5)
    expect(gun().hitChance(5)).toBe(0.25)
    expect(gun({ distance: 0 }).hitChance(1)).toBe(0)
    expect(gun({ accuracy: 1 }).hitChance(5, { minDamage: 1, accuracyFalloff: 2 })).toBe(0)
  })

  it('fires, spends a round and starts the cooldown', () => {
    expect(gun().shoot(request())).toEqual({
      ok: true,
      data: { rounds: 1, hitChance: 0.5 * (1 - 0.5 * (3 / 5)), energyCost: 5, patch: { loaded: 9, readyAt: 12_000 } }
    })
  })

  it('fires a batch and waits the batch cooldown', () => {
    const result = gun({ batchSize: 3, batchCooldown: 500 }).shoot(request())

    expect(result).toMatchObject({ data: { rounds: 3, energyCost: 15, patch: { loaded: 7, readyAt: 10_500 } } })
    expect(gun({ batchSize: 3, loaded: 2 }).shoot(request())).toMatchObject({ data: { rounds: 2 } })
  })

  it('refuses a shot that is out of reach, cooling down, unloaded or unaffordable', () => {
    expect(gun().shoot(request({ x: 9, y: 9 }))).toMatchObject({ code: 'OUT_OF_RANGE' })
    expect(gun({ readyAt: 10_001 }).shoot(request())).toMatchObject({ code: 'COOLDOWN' })
    expect(gun({ readyAt: 10_000 }).shoot(request())).toMatchObject({ ok: true })
    expect(gun({ loaded: 0 }).shoot(request())).toMatchObject({ code: 'NO_AMMO' })
    expect(gun().shoot(request(undefined, { energy: 4 }))).toMatchObject({ code: 'NO_ENERGY' })
  })

  it('counts the hits of a shot from the rolls', () => {
    const shot = { rounds: 3, hitChance: 0.5, energyCost: 15, patch: {} }
    const rolls = [0.1, 0.9, 0.49]

    expect(gun().resolve(shot, () => rolls.shift() ?? 1)).toBe(2)
  })

  it('does at least the minimum damage whatever the armor', () => {
    expect(gun().damageAgainst(10)).toBe(40)
    expect(gun().damageAgainst(500)).toBe(1)
    expect(gun().damageAgainst(500, { minDamage: 7, accuracyFalloff: 0 })).toBe(7)
  })

  it('reloads from the ammunition at hand', () => {
    expect(gun({ loaded: 4 }).reload(100)).toEqual({ ok: true, data: { taken: 6, patch: { loaded: 10 } } })
    expect(gun({ loaded: 4 }).reload(2)).toEqual({ ok: true, data: { taken: 2, patch: { loaded: 6 } } })
    expect(gun({ loaded: 10 }).reload(2)).toEqual({ ok: true, data: { taken: 0, patch: {} } })
    expect(gun({ loaded: 4 }).reload(0)).toMatchObject({ code: 'NO_AMMO' })
    expect(gun({}, { condition: 0 }).reload(5)).toMatchObject({ code: 'BROKEN_MODULE' })
  })
})
