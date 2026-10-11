import { DEFAULT_CRAFTING_CONFIG } from '../domain/crafting-config'
import { readCraftingConfig } from './crafting-config.reader'

const read = (file: unknown, env = { CRAFTING_RECIPES_FILE: 'recipes.json' }) => {
  const problems: string[] = []
  const config = readCraftingConfig(env, problems, () => (typeof file === 'string' ? file : JSON.stringify(file)))
  return { config, problems }
}

describe('readCraftingConfig', () => {
  it('uses the defaults without a file', () => {
    expect(read({}, {} as never)).toEqual({ config: DEFAULT_CRAFTING_CONFIG, problems: [] })
  })

  it('changes single fields of a recipe and of the balance', () => {
    const { config, problems } = read({
      recipes: { 'gun-class1': { craftTimeMs: 1000 } },
      balance: { researchCostFactor: 2 }
    })

    expect(problems).toEqual([])
    expect(config.recipes.find((r) => r.module === 'gun-class1')).toMatchObject({
      craftTimeMs: 1000,
      resources: [{ resource: 'iron', amount: 50 }]
    })
    expect(config.balance).toMatchObject({ researchCostFactor: 2, researchTimeFactor: 10 })
  })

  it('reports an unreadable file and falls back to the defaults', () => {
    expect(read('{ nope')).toEqual({
      config: DEFAULT_CRAFTING_CONFIG,
      problems: ['CRAFTING_RECIPES_FILE recipes.json must be a readable JSON file']
    })
  })

  it('reports invalid recipes, including a new one that is incomplete', () => {
    const { config, problems } = read({ recipes: { 'gun-class1': { craftTimeMs: -1 }, laser: {} } })

    expect(config).toBe(DEFAULT_CRAFTING_CONFIG)
    expect(problems).toEqual(
      expect.arrayContaining([
        'CRAFTING_RECIPES_FILE: gun-class1: craftTimeMs must be above zero',
        'CRAFTING_RECIPES_FILE: laser: no such module'
      ])
    )
  })

  it('reads the real file when none is injected', () => {
    const problems: string[] = []

    readCraftingConfig({ CRAFTING_RECIPES_FILE: '/definitely/not/here.json' }, problems)

    expect(problems).toHaveLength(1)
  })
})
