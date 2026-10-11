import { readFileSync } from 'fs'
import { ICraftingBalance, IRecipe } from '../../../../lib/utils/interfaces/crafting'
import { MODULE_CATALOG } from '../../modules/domain/module-catalog'
import { CraftingConfig, DEFAULT_CRAFTING_CONFIG } from '../domain/crafting-config'
import { validateRecipes } from '../domain/recipe-book'

type Env = Record<string, string | undefined>
type ReadFile = (path: string) => string

const readUtf8: ReadFile = (path) => readFileSync(path, 'utf8')

interface RecipesFile {
  // Recipes by module name: a partial one changes that recipe, a complete one adds it
  recipes?: Record<string, Partial<IRecipe>>
  balance?: Partial<ICraftingBalance>
}

// The defaults, overridden by the JSON file named in CRAFTING_RECIPES_FILE; a bad file is reported as problems
export function readCraftingConfig(env: Env, problems: string[], readFile: ReadFile = readUtf8): CraftingConfig {
  const path = env.CRAFTING_RECIPES_FILE
  if (!path) {
    return DEFAULT_CRAFTING_CONFIG
  }

  let file: RecipesFile
  try {
    file = JSON.parse(readFile(path))
  } catch {
    problems.push(`CRAFTING_RECIPES_FILE ${path} must be a readable JSON file`)
    return DEFAULT_CRAFTING_CONFIG
  }

  const overrides = file.recipes ?? {}
  const known = new Set(DEFAULT_CRAFTING_CONFIG.recipes.map((recipe) => recipe.module))
  const recipes = [
    ...DEFAULT_CRAFTING_CONFIG.recipes.map((recipe) => ({ ...recipe, ...overrides[recipe.module] })),
    ...Object.entries(overrides)
      .filter(([module]) => !known.has(module))
      .map(([module, recipe]) => ({ resources: [], ...recipe, module }) as IRecipe)
  ]
  const balance = { ...DEFAULT_CRAFTING_CONFIG.balance, ...file.balance }

  const invalid = validateRecipes(
    recipes,
    MODULE_CATALOG.map((template) => template.name),
    balance
  ).map((problem) => `CRAFTING_RECIPES_FILE: ${problem}`)
  problems.push(...invalid)
  return invalid.length ? DEFAULT_CRAFTING_CONFIG : { recipes, balance }
}
