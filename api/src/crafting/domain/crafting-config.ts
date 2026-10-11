import {
  DEFAULT_CRAFTING_BALANCE,
  DEFAULT_RECIPES,
  ICraftingBalance,
  IRecipe
} from '../../../../lib/utils/interfaces/crafting'

// The recipes and the crafting numbers (AGENTS.md §9): configuration, not game code
export interface CraftingConfig {
  recipes: readonly IRecipe[]
  balance: ICraftingBalance
}

export const CRAFTING_CONFIG = Symbol('CraftingConfig')

export const DEFAULT_CRAFTING_CONFIG: CraftingConfig = { recipes: DEFAULT_RECIPES, balance: DEFAULT_CRAFTING_BALANCE }
