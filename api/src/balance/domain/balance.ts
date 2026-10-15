import { IBalanceChange, IBalanceDocument } from '../../../../lib/utils/admin-balance'
import { DEFAULT_CRAFTING_BALANCE, ICraftingBalance, IRecipe } from '../../../../lib/utils/interfaces/crafting'
import { RESOURCES, ResourceBalance } from '../../../../lib/utils/interfaces/resources'
import { CraftingConfig } from '../../crafting/domain/crafting-config'
import { validateRecipes } from '../../crafting/domain/recipe-book'
import { validateResourceBalance } from '../../map/domain/resource-balance'
import { MODULE_CATALOG } from '../../modules/domain/module-catalog'

// What the balance of the game is made of; the rest of the configuration is not edited from the console
export interface BalanceConfig {
  resources: ResourceBalance
  crafting: CraftingConfig
}

const RESOURCE_FIELDS = ['spawnWeight', 'minAmount', 'maxAmount', 'hardness'] as const
const RECIPE_FIELDS = ['classLevel', 'resources', 'craftTimeMs'] as const
const CRAFTING_FIELDS = Object.keys(DEFAULT_CRAFTING_BALANCE)

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// What is wrong with the shape of a document, before it is laid over the defaults
function shapeProblems(document: unknown): string[] {
  if (!isObject(document)) {
    return ['the document must be an object']
  }
  const problems: string[] = []
  const unknownKeys = Object.keys(document).filter((key) => !['resources', 'recipes', 'crafting'].includes(key))
  problems.push(...unknownKeys.map((key) => `${key}: unknown section`))

  for (const [section, fields, allowedNames] of [
    ['resources', RESOURCE_FIELDS, RESOURCES as readonly string[]],
    ['recipes', RECIPE_FIELDS, null]
  ] as const) {
    const entries = document[section]
    if (entries === undefined) {
      continue
    }
    if (!isObject(entries)) {
      problems.push(`${section}: must be an object`)
      continue
    }
    for (const [name, values] of Object.entries(entries)) {
      if (allowedNames && !allowedNames.includes(name)) {
        problems.push(`${section}.${name}: unknown resource`)
      } else if (!isObject(values)) {
        problems.push(`${section}.${name}: must be an object`)
      } else {
        problems.push(
          ...Object.keys(values)
            .filter(
              (field) =>
                !(fields as readonly string[]).includes(field) && !(section === 'recipes' && field === 'module')
            )
            .map((field) => `${section}.${name}.${field}: unknown field`)
        )
      }
    }
  }
  if (document.crafting !== undefined) {
    if (!isObject(document.crafting)) {
      problems.push('crafting: must be an object')
    } else {
      problems.push(
        ...Object.keys(document.crafting)
          .filter((field) => !CRAFTING_FIELDS.includes(field))
          .map((field) => `crafting.${field}: unknown field`)
      )
    }
  }

  return problems
}

// Lays a document over a base: a partial resource or recipe changes that one, a complete recipe may add one
export function applyBalance(base: BalanceConfig, document: IBalanceDocument): BalanceConfig {
  const resources = Object.fromEntries(
    RESOURCES.map((resource) => [resource, { ...base.resources[resource], ...document.resources?.[resource] }])
  ) as ResourceBalance
  const overrides = document.recipes ?? {}
  const known = new Set(base.crafting.recipes.map((recipe) => recipe.module))
  const recipes: IRecipe[] = [
    ...base.crafting.recipes.map((recipe) => ({ ...recipe, ...overrides[recipe.module] })),
    ...Object.entries(overrides)
      .filter(([module]) => !known.has(module))
      .map(([module, recipe]) => ({ resources: [], ...recipe, module }) as IRecipe)
  ]

  return {
    resources,
    crafting: { recipes, balance: { ...base.crafting.balance, ...document.crafting } as ICraftingBalance }
  }
}

// Everything that is wrong with a document: its shape, and the rules of the resources and the recipes once laid over the base
export function validateBalance(base: BalanceConfig, document: unknown): string[] {
  const shape = shapeProblems(document)

  if (shape.length) {
    return shape
  }
  const merged = applyBalance(base, document as IBalanceDocument)

  return [
    ...validateResourceBalance(merged.resources),
    ...validateRecipes(
      merged.crafting.recipes,
      MODULE_CATALOG.map((template) => template.name),
      merged.crafting.balance
    )
  ]
}

// The balance as one flat map of paths to values, which is what a diff compares
export function flattenBalance({ resources, crafting }: BalanceConfig): Record<string, unknown> {
  const flat: Record<string, unknown> = {}

  for (const resource of RESOURCES) {
    for (const field of RESOURCE_FIELDS) {
      flat[`resources.${resource}.${field}`] = resources[resource][field]
    }
  }
  for (const recipe of crafting.recipes) {
    flat[`recipes.${recipe.module}.classLevel`] = recipe.classLevel
    flat[`recipes.${recipe.module}.craftTimeMs`] = recipe.craftTimeMs
    flat[`recipes.${recipe.module}.resources`] = recipe.resources
      .map(({ resource, amount }) => `${amount} ${resource}`)
      .join(', ')
  }
  for (const [field, value] of Object.entries(crafting.balance)) {
    flat[`crafting.${field}`] = value
  }

  return flat
}

const text = (value: unknown): string | null => (value === undefined ? null : String(value))

// What changes between two balances, by path; a path only one side has is shown against `undefined`
export function diffBalance(before: BalanceConfig, after: BalanceConfig): IBalanceChange[] {
  const from = flattenBalance(before)
  const to = flattenBalance(after)

  return [...new Set([...Object.keys(from), ...Object.keys(to)])]
    .sort()
    .filter((path) => from[path] !== to[path])
    .map((path) => ({ path, from: text(from[path]), to: text(to[path]) }))
}
