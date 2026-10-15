import { DEFAULT_CRAFTING_CONFIG } from '../../crafting/domain/crafting-config'
import { DEFAULT_WORLD_CONFIG } from '../../map/domain/world-config'
import { applyBalance, BalanceConfig, diffBalance, flattenBalance, validateBalance } from './balance'

const base: BalanceConfig = { resources: DEFAULT_WORLD_CONFIG.resources, crafting: DEFAULT_CRAFTING_CONFIG }

describe('applyBalance', () => {
  it('lays a partial resource, a partial recipe and some crafting numbers over the base', () => {
    const merged = applyBalance(base, {
      resources: { iron: { spawnWeight: 7 } },
      recipes: { 'gun-class1': { craftTimeMs: 1 } },
      crafting: { repairThreshold: 0.9 }
    })

    expect(merged.resources.iron).toEqual({ ...base.resources.iron, spawnWeight: 7 })
    expect(merged.resources.gold).toEqual(base.resources.gold)
    expect(merged.crafting.recipes.find((recipe) => recipe.module === 'gun-class1')).toMatchObject({
      craftTimeMs: 1,
      classLevel: 1
    })
    expect(merged.crafting.balance).toEqual({ ...base.crafting.balance, repairThreshold: 0.9 })
  })

  it('adds a recipe the base does not have, and changes nothing for an empty document', () => {
    const added = applyBalance(base, { recipes: { 'brand-new': { classLevel: 2, craftTimeMs: 5 } } })

    expect([...added.crafting.recipes].pop()).toEqual({
      module: 'brand-new',
      resources: [],
      classLevel: 2,
      craftTimeMs: 5
    })
    expect(applyBalance(base, {})).toEqual(base)
  })
})

describe('validateBalance', () => {
  it('accepts a document that changes nothing, or something valid', () => {
    expect(validateBalance(base, {})).toEqual([])
    expect(validateBalance(base, { resources: { iron: { hardness: 2 } }, crafting: { repairThreshold: 0.3 } })).toEqual(
      []
    )
  })

  it.each([
    [null, 'the document must be an object'],
    [[], 'the document must be an object'],
    [{ other: 1 }, 'other: unknown section'],
    [{ resources: 5 }, 'resources: must be an object'],
    [{ resources: { mithril: {} } }, 'resources.mithril: unknown resource'],
    [{ resources: { iron: 5 } }, 'resources.iron: must be an object'],
    [{ resources: { iron: { colour: 1 } } }, 'resources.iron.colour: unknown field'],
    [{ recipes: { x: { colour: 1 } } }, 'recipes.x.colour: unknown field'],
    [{ crafting: 3 }, 'crafting: must be an object'],
    [{ crafting: { speed: 3 } }, 'crafting.speed: unknown field']
  ])('refuses the shape %j', (document, problem) => {
    expect(validateBalance(base, document)).toEqual([problem])
  })

  it('lets a recipe name its module, and checks the rules of the merged resources and recipes', () => {
    expect(validateBalance(base, { recipes: { 'gun-class1': { module: 'gun-class1' } } })).toEqual([])
    expect(validateBalance(base, { resources: { iron: { minAmount: 9_999_999 } } })).toEqual([
      'iron: minAmount must not exceed maxAmount'
    ])
    expect(validateBalance(base, { recipes: { 'gun-class1': { craftTimeMs: -1 } } })).not.toEqual([])
  })
})

describe('flattenBalance and diffBalance', () => {
  it('flattens the balance to paths, writing a recipe cost as text', () => {
    const flat = flattenBalance(base)

    expect(flat['resources.iron.spawnWeight']).toBe(base.resources.iron.spawnWeight)
    expect(flat['recipes.gun-class1.resources']).toBe('50 iron')
    expect(flat['crafting.repairThreshold']).toBe(0.2)
  })

  it('lists what differs by path, sorted, and shows a path only one side has against null', () => {
    const after = applyBalance(base, {
      resources: { iron: { spawnWeight: 1 } },
      recipes: { 'gun-class1': { craftTimeMs: 1 }, 'brand-new': { craftTimeMs: 5 } }
    })

    const changes = diffBalance(base, after)

    expect(changes.map(({ path }) => path)).toEqual([...changes.map(({ path }) => path)].sort())
    expect(changes).toContainEqual({
      path: 'resources.iron.spawnWeight',
      from: String(base.resources.iron.spawnWeight),
      to: '1'
    })
    expect(changes).toContainEqual({ path: 'recipes.gun-class1.craftTimeMs', from: '20000', to: '1' })
    expect(changes).toContainEqual({ path: 'recipes.brand-new.craftTimeMs', from: null, to: '5' })
    expect(diffBalance(base, base)).toEqual([])
  })
})
