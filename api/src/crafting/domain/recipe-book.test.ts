import { DEFAULT_CRAFTING_BALANCE, DEFAULT_RECIPES, IRecipe } from '../../../../lib/utils/interfaces/crafting'
import { RESOURCE } from '../../../../lib/utils/interfaces/resources'
import { MODULE_CATALOG } from '../../modules/domain/module-catalog'
import { UnknownRecipeError } from './crafting.errors'
import { RecipeBook, validateRecipes } from './recipe-book'

const names = MODULE_CATALOG.map((template) => template.name)
const problemsOf = (recipes: readonly IRecipe[], balance = DEFAULT_CRAFTING_BALANCE) =>
  validateRecipes(recipes, names, balance)
const book = new RecipeBook(DEFAULT_RECIPES, DEFAULT_CRAFTING_BALANCE)
const replace = (module: string, change: Partial<IRecipe>) =>
  DEFAULT_RECIPES.map((recipe) => (recipe.module === module ? { ...recipe, ...change } : recipe))

describe('validateRecipes', () => {
  it('accepts the default recipes, which cover the whole catalog', () => {
    expect(problemsOf(DEFAULT_RECIPES)).toEqual([])
  })

  it('reports a module without a recipe, an unknown module and a duplicate', () => {
    expect(problemsOf(DEFAULT_RECIPES.slice(1))).toEqual(['scanner-class1: has no recipe', expect.any(String)])
    expect(problemsOf([...DEFAULT_RECIPES, { ...DEFAULT_RECIPES[0], module: 'laser' }])).toContain(
      'laser: no such module'
    )
    expect(problemsOf([...DEFAULT_RECIPES, DEFAULT_RECIPES[0]])).toContain('scanner-class1: more than one recipe')
  })

  it('reports unusable numbers and resources', () => {
    expect(problemsOf(replace('gun-class1', { classLevel: 0 }))).toContain(
      'gun-class1: classLevel must be a whole number from 1'
    )
    expect(problemsOf(replace('gun-class1', { craftTimeMs: 0 }))).toContain(
      'gun-class1: craftTimeMs must be above zero'
    )
    expect(problemsOf(replace('gun-class1', { resources: [] }))).toContain('gun-class1: needs at least one resource')
    expect(
      problemsOf(replace('gun-class1', { resources: [{ resource: 'mithril' as RESOURCE, amount: 1 }] }))
    ).toContain('gun-class1: unknown resource mithril')
    expect(problemsOf(replace('gun-class1', { resources: [{ resource: RESOURCE.IRON, amount: -1 }] }))).toContain(
      'gun-class1: the amount of iron must be above zero'
    )
  })

  it('needs the class below for a class above 1', () => {
    const orphan = replace('scanner-class2', { classLevel: 3 })

    expect(problemsOf(orphan)).toContain('scanner-class2: there is no recipe of class 2 to research it from')
  })

  it('reports bad balance numbers', () => {
    expect(problemsOf(DEFAULT_RECIPES, { ...DEFAULT_CRAFTING_BALANCE, researchCostFactor: 0 })).toContain(
      'the research factors must be above zero'
    )
    expect(problemsOf(DEFAULT_RECIPES, { ...DEFAULT_CRAFTING_BALANCE, researchTimeFactor: NaN })).toContain(
      'the research factors must be above zero'
    )
    expect(problemsOf(DEFAULT_RECIPES, { ...DEFAULT_CRAFTING_BALANCE, lootBlueprintChance: 2 })).toContain(
      'the blueprint chances must be between 0 and 1'
    )
    expect(problemsOf(DEFAULT_RECIPES, { ...DEFAULT_CRAFTING_BALANCE, worldBlueprintChance: -1 })).toContain(
      'the blueprint chances must be between 0 and 1'
    )
  })
})

describe('validateRecipes (repair numbers)', () => {
  it('reports a repair threshold or scrap share outside 0..1, inverted scrap shares and a negative repair cost', () => {
    const wrong = (change: Partial<typeof DEFAULT_CRAFTING_BALANCE>) =>
      problemsOf(DEFAULT_RECIPES, { ...DEFAULT_CRAFTING_BALANCE, ...change })

    expect(wrong({ repairThreshold: 2 })).toContain('the repair threshold and the scrap shares must be between 0 and 1')
    expect(wrong({ scrapMaxShare: -1 })).toContain('the repair threshold and the scrap shares must be between 0 and 1')
    expect(wrong({ scrapMinShare: 0.9, scrapMaxShare: 0.2 })).toContain('scrapMinShare must not exceed scrapMaxShare')
    expect(wrong({ repairCostFactor: -1 })).toContain('repairCostFactor must not be negative')
    expect(wrong({})).toEqual([])
  })
})

describe('RecipeBook', () => {
  it('finds a recipe by module, and refuses an unknown one', () => {
    expect(book.get('gun-class1')).toMatchObject({ resources: [{ resource: 'iron', amount: 50 }], craftTimeMs: 20_000 })
    expect(book.find('laser')).toBeUndefined()
    expect(() => book.get('laser')).toThrow(UnknownRecipeError)
    expect(book.all()).toHaveLength(DEFAULT_RECIPES.length)
  })

  it('knows class 1 from the start and what was learned on top', () => {
    expect(book.baseSet()).toHaveLength(16)
    expect(book.baseSet()).toContain('scanner-class1')
    expect(book.baseSet()).not.toContain('scanner-class2')
    expect(book.known([])).not.toContain('scanner-class2')
    expect(book.known(['scanner-class2'])).toContain('scanner-class2')
  })

  it('finds the class a module is researched from', () => {
    expect(book.previousClass('scanner-class2')?.module).toBe('scanner-class1')
    expect(book.previousClass('scanner-class1')).toBeUndefined()
  })

  it('prices research at the configured multiples of cost and time', () => {
    expect(book.researchCost('scanner-class2')).toEqual({
      resources: [
        { resource: 'iron', amount: 200 },
        { resource: 'crystal', amount: 75 }
      ],
      timeMs: 200_000
    })
    expect(
      new RecipeBook(DEFAULT_RECIPES, { ...DEFAULT_CRAFTING_BALANCE, researchCostFactor: 1.5 }).researchCost(
        'wheels-class1'
      ).resources
    ).toEqual([{ resource: 'iron', amount: 38 }])
  })
})
