import { PrismaClient } from '@prisma/client'
import { DEFAULT_GAME_TIME_SETTINGS, GameTimeSettings } from '../../../../lib/utils/game-time'
import { GameTimeStore, StoredGameTime } from '../application/game-time-settings.service'

const GAME_TIME_KEY = 'gameTime'

export class PrismaGameTimeStore implements GameTimeStore {
  constructor(private readonly db: PrismaClient) {}

  async load(): Promise<StoredGameTime> {
    const row = await this.db.gameSetting.findUnique({ where: { key: GAME_TIME_KEY } })

    return {
      settings: { ...DEFAULT_GAME_TIME_SETTINGS, ...(row?.value as Partial<GameTimeSettings> | null | undefined) },
      updatedAt: row?.updatedAt ?? null
    }
  }

  async save(settings: GameTimeSettings, at: Date): Promise<void> {
    await this.db.gameSetting.upsert({
      where: { key: GAME_TIME_KEY },
      create: { key: GAME_TIME_KEY, value: { ...settings }, updatedAt: at },
      update: { value: { ...settings }, updatedAt: at }
    })
  }
}
