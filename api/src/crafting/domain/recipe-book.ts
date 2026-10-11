import { ICraftingBalance, IRecipe } from '../../../../lib/utils/interfaces/crafting'
import { IResourceStack, RESOURCES } from '../../../../lib/utils/interfaces/resources'
import { UnknownRecipeError } from './crafting.errors'

// What researching a module costs (design §9.3)
export interface ResearchCost {
  resources: IResourceStack[]
  timeMs: number
}

// The modules of a family differ only in the class: `scanner-class1`, `scanner-class2` → `scanner`
const familyOf = (module: string) => module.replace(/-class\d+$/, '')

const isPositive = (value: number) => Number.isFinite(value) && value > 0

// The problems of a recipe set, empty when it is usable. Every module of the catalog needs exactly one recipe, and a
// class above 1 needs the recipe of the class below it (that is what research builds on).
export function validateRecipes(
  recipes: readonly IRecipe[],
  moduleNames: readonly string[],
  balance: ICraftingBalance
): string[] {
  const problems: string[] = []
  const seen = new Set<string>()

  for (const recipe of recipes) {
    if (seen.has(recipe.module)) {
      problems.push(`${recipe.module}: more than one recipe`)
    }
    seen.add(recipe.module)

    if (!moduleNames.includes(recipe.module)) {
      problems.push(`${recipe.module}: no such module`)
    }
    if (!Number.isInteger(recipe.classLevel) || recipe.classLevel < 1) {
      problems.push(`${recipe.module}: classLevel must be a whole number from 1`)
    }
    if (!isPositive(recipe.craftTimeMs)) {
      problems.push(`${recipe.module}: craftTimeMs must be above zero`)
    }
    if (!recipe.resources.length) {
      problems.push(`${recipe.module}: needs at least one resource`)
    }
    for (const { resource, amount } of recipe.resources) {
      if (!RESOURCES.includes(resource)) {
        problems.push(`${recipe.module}: unknown resource ${resource}`)
      } else if (!isPositive(amount)) {
        problems.push(`${recipe.module}: the amount of ${resource} must be above zero`)
      }
    }
  }

  for (const name of moduleNames) {
    if (!seen.has(name)) {
      problems.push(`${name}: has no recipe`)
    }
  }
  for (const recipe of recipes.filter((candidate) => candidate.classLevel > 1)) {
    const below = recipes.some(
      (other) => familyOf(other.module) === familyOf(recipe.module) && other.classLevel === recipe.classLevel - 1
    )
    if (!below) {
      problems.push(`${recipe.module}: there is no recipe of class ${recipe.classLevel - 1} to research it from`)
    }
  }

  if (!isPositive(balance.researchCostFactor) || !isPositive(balance.researchTimeFactor)) {
    problems.push('the research factors must be above zero')
  }
  for (const chance of [balance.worldBlueprintChance, balance.lootBlueprintChance]) {
    if (!(chance >= 0 && chance <= 1)) {
      problems.push('the blueprint chances must be between 0 and 1')
    }
  }
  return problems
}

// The recipes of the game, looked up by module name
export class RecipeBook {
  private readonly byModule: Map<string, IRecipe>

  constructor(
    recipes: readonly IRecipe[],
    readonly balance: ICraftingBalance
  ) {
    this.byModule = new Map(recipes.map((recipe) => [recipe.module, recipe]))
  }

  all(): IRecipe[] {
    return [...this.byModule.values()]
  }

  find(module: string): IRecipe | undefined {
    return this.byModule.get(module)
  }

  get(module: string): IRecipe {
    const recipe = this.find(module)
    if (!recipe) {
      throw new UnknownRecipeError(module)
    }
    return recipe
  }

  // The blueprints every player knows from the start: class 1
  baseSet(): string[] {
    return this.all()
      .filter((recipe) => recipe.classLevel === 1)
      .map((recipe) => recipe.module)
  }

  // Everything a player knows: the base set and the blueprints learned
  known(learned: readonly string[]): Set<string> {
    return new Set([...this.baseSet(), ...learned])
  }

  // The recipe of the next lower class of the same module, the one research builds on
  previousClass(module: string): IRecipe | undefined {
    const recipe = this.get(module)
    return this.all().find(
      (other) => familyOf(other.module) === familyOf(module) && other.classLevel === recipe.classLevel - 1
    )
  }

  researchCost(module: string): ResearchCost {
    const { resources, craftTimeMs } = this.get(module)
    return {
      resources: resources.map(({ resource, amount }) => ({
        resource,
        amount: Math.ceil(amount * this.balance.researchCostFactor)
      })),
      timeMs: Math.ceil(craftTimeMs * this.balance.researchTimeFactor)
    }
  }
}
