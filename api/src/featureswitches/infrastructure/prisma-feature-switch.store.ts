import { PrismaClient } from '@prisma/client'
import { featuresWithDefaults, FeatureSwitches } from '../../../../lib/utils/interfaces/features'
import { FeatureSwitchStore, StoredFeatureSwitches } from '../application/feature-switches.service'

const FEATURES_KEY = 'features'

export class PrismaFeatureSwitchStore implements FeatureSwitchStore {
  constructor(private readonly db: PrismaClient) {}

  async load(): Promise<StoredFeatureSwitches> {
    const row = await this.db.gameSetting.findUnique({ where: { key: FEATURES_KEY } })

    return {
      features: featuresWithDefaults(row?.value as Record<string, boolean> | undefined),
      updatedAt: row?.updatedAt ?? null
    }
  }

  async save(features: FeatureSwitches, updatedAt: Date): Promise<void> {
    await this.db.gameSetting.upsert({
      where: { key: FEATURES_KEY },
      create: { key: FEATURES_KEY, value: features, updatedAt },
      update: { value: features, updatedAt }
    })
  }
}
