import { Feature, featuresWithDefaults, FeatureSwitches, FEATURES } from '../../../../lib/utils/interfaces/features'
import { Clock } from '../../shared/application/clock'
import { ValidationError } from '../../shared/domain/errors'
import { FeatureDisabledError } from '../domain/feature.errors'

export const FEATURE_SWITCH_STORE = Symbol('FeatureSwitchStore')

export interface StoredFeatureSwitches {
  features: FeatureSwitches
  updatedAt: Date | null
}

// Where the switches are kept: the game settings of the database, shared by every node
export interface FeatureSwitchStore {
  load(): Promise<StoredFeatureSwitches>
  save(features: FeatureSwitches, updatedAt: Date): Promise<void>
}

// The switches of whole features of the game (design §25.3). Every node reads them from the store and keeps them for a short
// time, so a change reaches all nodes within `cacheMs` and the nodes do not ask for every request.
export class FeatureSwitchesService {
  private cached: { value: StoredFeatureSwitches; expiresAt: number } | null = null

  constructor(
    private readonly store: FeatureSwitchStore,
    private readonly clock: Clock,
    private readonly cacheMs: number
  ) {}

  async get(): Promise<StoredFeatureSwitches> {
    const now = this.clock.now().getTime()

    if (this.cached && this.cached.expiresAt > now) {
      return this.cached.value
    }
    const value = await this.store.load()
    this.cached = { value, expiresAt: now + this.cacheMs }

    return value
  }

  // Refuses with FEATURE_DISABLED when the feature is off
  async assertEnabled(feature: Feature): Promise<void> {
    if (!(await this.get()).features[feature]) {
      throw new FeatureDisabledError(feature)
    }
  }

  // Changes only the features the patch names; the controller adds the reason and the audit entry
  async update(
    patch: Partial<Record<string, unknown>>
  ): Promise<{ before: FeatureSwitches; after: StoredFeatureSwitches }> {
    const names = Object.entries(patch)

    if (!names.length) {
      throw new ValidationError('Name at least one feature')
    }
    for (const [name, value] of names) {
      if (!(FEATURES as readonly string[]).includes(name) || typeof value !== 'boolean') {
        throw new ValidationError(`Invalid feature switch: ${name}`)
      }
    }
    // The current state is read from the store, not from the cache: a change builds on the last one saved
    const before = (await this.store.load()).features
    const features = featuresWithDefaults({ ...before, ...patch })
    const updatedAt = this.clock.now()

    await this.store.save(features, updatedAt)
    this.cached = { value: { features, updatedAt }, expiresAt: updatedAt.getTime() + this.cacheMs }

    return { before, after: { features, updatedAt } }
  }
}
