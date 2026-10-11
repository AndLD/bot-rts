import { IRecipe } from '../../../../lib/utils/interfaces/crafting'
import { RecipeBook, ResearchCost } from '../domain/recipe-book'
import { BlueprintRepository } from './blueprint.repository'

// A recipe as one player sees it
export interface RecipeView extends IRecipe {
  // The player has the blueprint (the base set or learned)
  isKnown: boolean
  // The player can research it now: the class below it is known
  canResearch: boolean
  // What researching costs; classes above 1 only
  research: ResearchCost | null
}

export class RecipeService {
  constructor(
    private readonly book: RecipeBook,
    private readonly blueprints: BlueprintRepository
  ) {}

  async listFor(userId: string): Promise<RecipeView[]> {
    const learned = (await this.blueprints.listOfUser(userId)).map((blueprint) => blueprint.module)
    const known = this.book.known(learned)

    return this.book.all().map((recipe) => {
      const isKnown = known.has(recipe.module)
      const below = this.book.previousClass(recipe.module)
      return {
        ...recipe,
        isKnown,
        canResearch: !isKnown && !!below && known.has(below.module),
        research: recipe.classLevel > 1 ? this.book.researchCost(recipe.module) : null
      }
    })
  }
}
