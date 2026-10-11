import { BlueprintSource, DEFAULT_CRAFTING_BALANCE, DEFAULT_RECIPES } from '../../../../lib/utils/interfaces/crafting'
import { InMemoryBlueprintRepository } from '../../../tests/fakes/fakes'
import { RecipeBook } from '../domain/recipe-book'
import { RecipeService } from './recipe.service'

function setup() {
  const blueprints = new InMemoryBlueprintRepository()
  return {
    blueprints,
    service: new RecipeService(new RecipeBook(DEFAULT_RECIPES, DEFAULT_CRAFTING_BALANCE), blueprints)
  }
}

describe('RecipeService.listFor', () => {
  it('shows a new player the base set as known and the next classes as researchable', async () => {
    const { service } = setup()

    const recipes = await service.listFor('alice')

    expect(recipes).toHaveLength(DEFAULT_RECIPES.length)
    expect(recipes.find((r) => r.module === 'scanner-class1')).toMatchObject({
      isKnown: true,
      canResearch: false,
      research: null
    })
    expect(recipes.find((r) => r.module === 'scanner-class2')).toMatchObject({
      isKnown: false,
      canResearch: true,
      research: { timeMs: 200_000 }
    })
  })

  it('marks what the player learned, and nobody else', async () => {
    const { service, blueprints } = setup()
    await blueprints.add({ userId: 'alice', module: 'scanner-class2', source: BlueprintSource.RESEARCH })

    const find = async (user: string) => (await service.listFor(user)).find((r) => r.module === 'scanner-class2')

    expect(await find('alice')).toMatchObject({ isKnown: true, canResearch: false })
    expect(await find('bob')).toMatchObject({ isKnown: false })
  })
})
