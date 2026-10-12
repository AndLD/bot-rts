import {
  CategorySwitches,
  effectiveSwitches,
  IGameSettings,
  ISettings,
  ManualCategory,
  MANUAL_CATEGORIES
} from '../../../../lib/utils/interfaces/settings'
import { ManualPolicy } from '../../engine/application/engine-ports'
import { ValidationError } from '../../shared/domain/errors'
import { SettingsRepository } from './settings.repository'

// What a player may change of their settings: the switches they give, and whether motion is reduced
export interface UserSettingsPatch {
  categories?: Partial<Record<string, unknown>>
  reducedMotion?: boolean | null
}

// Checks that the patch names only categories, with booleans
function validSwitches(patch: Partial<Record<string, unknown>>): Partial<Record<ManualCategory, boolean>> {
  const result: Partial<Record<ManualCategory, boolean>> = {}

  for (const [name, value] of Object.entries(patch)) {
    if (!MANUAL_CATEGORIES.includes(name as ManualCategory) || typeof value !== 'boolean') {
      throw new ValidationError(`Invalid setting: ${name}`)
    }
    result[name as ManualCategory] = value
  }

  return result
}

// The settings of the game and of each player (design §15.1). Global is the ceiling and the personal switches narrow it.
export class SettingsService implements ManualPolicy {
  constructor(private readonly settings: SettingsRepository) {}

  async get(userId: string): Promise<ISettings> {
    const [categories, user] = await Promise.all([this.settings.getGameCategories(), this.settings.getUser(userId)])

    return {
      global: { categories },
      user,
      effective: effectiveSwitches(categories, user.categories)
    }
  }

  async updateUser(userId: string, patch: UserSettingsPatch): Promise<ISettings> {
    const current = await this.settings.getUser(userId)
    const reducedMotion = patch.reducedMotion
    if (reducedMotion !== undefined && reducedMotion !== null && typeof reducedMotion !== 'boolean') {
      throw new ValidationError('Invalid setting: reducedMotion')
    }

    await this.settings.saveUser(userId, {
      categories: { ...current.categories, ...validSwitches(patch.categories ?? {}) },
      reducedMotion: reducedMotion === undefined ? current.reducedMotion : reducedMotion
    })

    return this.get(userId)
  }

  async getGame(): Promise<IGameSettings> {
    return { categories: await this.settings.getGameCategories() }
  }

  async updateGame(patch: Partial<Record<string, unknown>>): Promise<IGameSettings> {
    const categories: CategorySwitches = { ...(await this.settings.getGameCategories()), ...validSwitches(patch) }
    await this.settings.saveGameCategories(categories)

    return { categories }
  }

  async isAllowed(userId: string, category: ManualCategory): Promise<boolean> {
    return (await this.get(userId)).effective[category]
  }
}
