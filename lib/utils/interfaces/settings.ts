// The settings of the game (design §15.1). Manual control is split into eight categories by what the action does; a
// category is available to a player when it is on in the game settings AND in the player's own settings.
export enum ManualCategory {
  MOVEMENT = 'movement',
  COMBAT = 'combat',
  EXTRACTION = 'extraction',
  LOGISTICS = 'logistics',
  FABRICATION = 'fabrication',
  MAINTENANCE = 'maintenance',
  COMMUNICATION = 'communication',
  TRADE = 'trade'
}

export const MANUAL_CATEGORIES: readonly ManualCategory[] = Object.values(ManualCategory)

export type CategorySwitches = Record<ManualCategory, boolean>

export const ALL_CATEGORIES_ON: CategorySwitches = Object.fromEntries(
  MANUAL_CATEGORIES.map((category) => [category, true])
) as CategorySwitches

// The switches with every category the list does not mention on (so a category added later starts on)
export function withDefaults(switches: Partial<Record<string, boolean>> | null | undefined): CategorySwitches {
  return Object.fromEntries(
    MANUAL_CATEGORIES.map((category) => [category, switches?.[category] !== false])
  ) as CategorySwitches
}

// Global is the ceiling and the player narrows: a category is available only if it is on in both
export function effectiveSwitches(global: CategorySwitches, personal: CategorySwitches): CategorySwitches {
  return Object.fromEntries(
    MANUAL_CATEGORIES.map((category) => [category, global[category] && personal[category]])
  ) as CategorySwitches
}

export interface IGameSettings {
  categories: CategorySwitches
}

export interface IUserSettings {
  categories: CategorySwitches
  // Replace movement and effects by instant changes; null follows the setting of the system (design §15.2)
  reducedMotion: boolean | null
}

export interface ISettings {
  global: IGameSettings
  user: IUserSettings
  // What the player can use: the global and the personal switches together
  effective: CategorySwitches
}

// The categories each action of the script API belongs to, for the actions done by hand. Observation (scan, view, where am
// I, the radio, reading files) is always on and has no category; `sleep` is not a manual action.
const FUNCTION_CATEGORIES: ReadonlyMap<string, ManualCategory> = new Map([
  ['move', ManualCategory.MOVEMENT],
  ['turn', ManualCategory.MOVEMENT],
  ['aim', ManualCategory.COMBAT],
  ['shoot', ManualCategory.COMBAT],
  ['reload', ManualCategory.COMBAT],
  ['dig', ManualCategory.EXTRACTION],
  ['mine', ManualCategory.EXTRACTION],
  ['pick', ManualCategory.EXTRACTION],
  ['take', ManualCategory.EXTRACTION],
  ['drop', ManualCategory.EXTRACTION],
  ['craft', ManualCategory.FABRICATION],
  ['assemble', ManualCategory.FABRICATION],
  ['research', ManualCategory.FABRICATION],
  ['learn', ManualCategory.FABRICATION],
  ['repair', ManualCategory.MAINTENANCE],
  ['disassemble', ManualCategory.MAINTENANCE],
  ['enable', ManualCategory.MAINTENANCE],
  ['disable', ManualCategory.MAINTENANCE]
])

export function categoryOfFunction(name: string): ManualCategory | null {
  return FUNCTION_CATEGORIES.get(name) ?? null
}
