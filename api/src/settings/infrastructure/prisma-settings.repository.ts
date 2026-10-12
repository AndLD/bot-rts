import { PrismaClient } from '@prisma/client'
import { CategorySwitches, IUserSettings, withDefaults } from '../../../../lib/utils/interfaces/settings'
import { SettingsRepository } from '../application/settings.repository'

const CATEGORIES_KEY = 'manualCategories'

export class PrismaSettingsRepository implements SettingsRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly now: () => Date = () => new Date()
  ) {}

  async getGameCategories(): Promise<CategorySwitches> {
    const row = await this.db.gameSetting.findUnique({ where: { key: CATEGORIES_KEY } })

    return withDefaults(row?.value as Record<string, boolean> | undefined)
  }

  async saveGameCategories(categories: CategorySwitches): Promise<void> {
    const updatedAt = this.now()

    await this.db.gameSetting.upsert({
      where: { key: CATEGORIES_KEY },
      create: { key: CATEGORIES_KEY, value: categories, updatedAt },
      update: { value: categories, updatedAt }
    })
  }

  async getUser(userId: string): Promise<IUserSettings> {
    const row = await this.db.userSetting.findUnique({ where: { userId } })

    return {
      categories: withDefaults(row?.manualCategories as Record<string, boolean> | undefined),
      reducedMotion: row?.reducedMotion ?? null
    }
  }

  async saveUser(userId: string, settings: IUserSettings): Promise<void> {
    const data = { manualCategories: settings.categories, reducedMotion: settings.reducedMotion, updatedAt: this.now() }

    await this.db.userSetting.upsert({ where: { userId }, create: { userId, ...data }, update: data })
  }
}
