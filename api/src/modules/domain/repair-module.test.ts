import { DEFAULT_CRAFTING_BALANCE, DEFAULT_RECIPES } from '../../../../lib/utils/interfaces/crafting'
import { buildModule } from '../../../tests/integration/builders'
import { GameModule, BatteryModule } from './game-module'
import { RepairModule, scrapOf } from './repair-module'

const repairer = (props: Record<string, unknown> = {}, overrides = {}) =>
  new RepairModule(
    buildModule('bot', { type: 'repair', props: { repairPerOp: 25, delay: 1000, ...props }, ...overrides })
  )
const target = (condition: number, maxCondition = 100) =>
  new BatteryModule(buildModule('other', { type: 'battery', name: 'gun-class1', condition, maxCondition }))
const recipe = DEFAULT_RECIPES.find((r) => r.module === 'gun-class1') as (typeof DEFAULT_RECIPES)[number]
const balance = DEFAULT_CRAFTING_BALANCE

describe('RepairModule.repair', () => {
  it('restores one operation worth of condition and charges a share of the recipe', () => {
    expect(repairer().repair(target(50), recipe, 100, balance)).toEqual({
      ok: true,
      data: { condition: 75, cost: [{ resource: 'iron', amount: 7 }], patch: { readyAt: 1100 } }
    })
  })

  it('restores no more than the module is missing', () => {
    expect(repairer().repair(target(90), recipe, 0, balance)).toMatchObject({
      data: { condition: 100, cost: [{ resource: 'iron', amount: 3 }] }
    })
  })

  it('repairs a broken module, and a damaged one that is healthy enough', () => {
    expect(repairer().repair(target(0), recipe, 0, balance)).toMatchObject({ ok: true, data: { condition: 25 } })
    expect(repairer().repair(target(20), recipe, 0, balance)).toMatchObject({ ok: true })
  })

  it('refuses a module that is damaged beyond repair, one that is intact and a repairer that cannot', () => {
    expect(repairer().repair(target(19), recipe, 0, balance)).toMatchObject({ code: 'TOO_LOW' })
    expect(repairer().repair(target(100), recipe, 0, balance)).toMatchObject({ code: 'EMPTY' })
    expect(repairer({}, { condition: 0 }).repair(target(50), recipe, 0, balance)).toMatchObject({
      code: 'BROKEN_MODULE'
    })
    expect(repairer({ repairPerOp: 0 }).repair(target(50), recipe, 0, balance)).toMatchObject({ code: 'TOO_LOW' })
  })

  it('waits for the cooldown', () => {
    const busy = repairer({ readyAt: 1000 })

    expect(busy.repair(target(50), recipe, 999, balance)).toMatchObject({ code: 'COOLDOWN' })
    expect(busy.repair(target(50), recipe, 1000, balance)).toMatchObject({ ok: true })
    expect(repairer().delay).toBe(1000)
    expect(repairer().repairPerOp).toBe(25)
  })
})

describe('RepairModule.disassemble', () => {
  it('takes apart a module of an own bot, or a broken module of anybody', () => {
    expect(repairer().disassemble(target(80), true, 100)).toEqual({ ok: true, data: { patch: { readyAt: 1100 } } })
    expect(repairer().disassemble(target(0), false, 0)).toMatchObject({ ok: true })
  })

  it('does not strip a working module of another player', () => {
    expect(repairer().disassemble(target(80), false, 0)).toMatchObject({ ok: false, code: 'FORBIDDEN' })
  })

  it('needs a working repair module off cooldown', () => {
    expect(repairer({}, { condition: 0 }).disassemble(target(0), true, 0)).toMatchObject({ code: 'BROKEN_MODULE' })
    expect(repairer({ readyAt: 5 }).disassemble(target(0), true, 4)).toMatchObject({ code: 'COOLDOWN' })
  })
})

describe('scrapOf', () => {
  it('returns a share of the recipe between the minimum and the maximum', () => {
    expect(scrapOf(recipe, 0, balance)).toEqual([{ resource: 'iron', amount: 15 }])
    expect(scrapOf(recipe, 0.999, balance)).toEqual([{ resource: 'iron', amount: 24 }])
  })

  it('leaves out what rounds down to nothing', () => {
    const small = { ...recipe, resources: [{ resource: recipe.resources[0].resource, amount: 2 }] }

    expect(scrapOf(small, 0, balance)).toEqual([])
  })
})

it('is a game module like the others', () => {
  expect(repairer()).toBeInstanceOf(GameModule)
})
