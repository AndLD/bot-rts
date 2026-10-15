// The switches of whole features of the game (design §25.3, Economy and balance). An admin can switch each off for every
// player; what is off answers `FEATURE_DISABLED`. A feature nobody switched is on, so one added later starts on.
export const FEATURES = ['signUps', 'baseDeployment', 'apiKeys', 'spawnSeeds', 'publicApi'] as const

export type Feature = (typeof FEATURES)[number]

export type FeatureSwitches = Record<Feature, boolean>

export function isFeature(value: unknown): value is Feature {
  return (FEATURES as readonly unknown[]).includes(value)
}

// The switches with every feature the stored ones do not switch off on
export function featuresWithDefaults(stored: Partial<Record<string, unknown>> | null | undefined): FeatureSwitches {
  return Object.fromEntries(FEATURES.map((feature) => [feature, stored?.[feature] !== false])) as FeatureSwitches
}

// What the client may know without signing in (GET /api/v1/features): which features are off, so the screens hide or explain them
export interface IFeatureStatus {
  features: FeatureSwitches
}

// What the console shows and changes (GET and PATCH /api/v1/admin/features)
export interface IFeatureSwitches extends IFeatureStatus {
  // Milliseconds since the epoch of the last change, null when nobody has changed anything
  updatedAt: number | null
}
