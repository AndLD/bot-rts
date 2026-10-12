import { CategorySwitches, IUserSettings } from '../../../../lib/utils/interfaces/settings'

export const SETTINGS_REPOSITORY = Symbol('SettingsRepository')

// Where the settings are kept (design §15.1). A setting nobody has set reads as its default: everything on, motion as the system.
export interface SettingsRepository {
  getGameCategories(): Promise<CategorySwitches>
  saveGameCategories(categories: CategorySwitches): Promise<void>
  getUser(userId: string): Promise<IUserSettings>
  saveUser(userId: string, settings: IUserSettings): Promise<void>
}
