// What the game counts for every player (design §23.1). A counter only grows; an achievement unlocks when its counter reaches its
// threshold, so progress is kept per player and survives losing a base.
export const COUNTERS = [
  'basesDeployed',
  'scriptRuns',
  'cellsScanned',
  'unitsMined',
  'modulesCrafted',
  'botsAssembled',
  'modulesRepaired',
  'modulesDisassembled',
  'botsAdopted',
  'shotsHit',
  'cellsTravelled',
  'tutorialsCompleted'
] as const

export type Counter = (typeof COUNTERS)[number]

// A family is one idea with one or more levels, each with its own threshold; a hidden family is listed only once unlocked
export interface AchievementFamily {
  family: string
  counter: Counter
  thresholds: readonly number[]
  isHidden?: boolean
}

// The initial set (design §23.2). Adding an achievement is adding a record here and its texts to the message catalogues.
export const ACHIEVEMENT_FAMILIES: readonly AchievementFamily[] = [
  { family: 'firstSteps', counter: 'basesDeployed', thresholds: [1] },
  { family: 'helloWorld', counter: 'scriptRuns', thresholds: [1] },
  { family: 'prospector', counter: 'cellsScanned', thresholds: [100, 1_000, 10_000] },
  { family: 'miner', counter: 'unitsMined', thresholds: [10, 100, 1_000] },
  { family: 'fabricator', counter: 'modulesCrafted', thresholds: [1, 10, 100] },
  { family: 'assembler', counter: 'botsAssembled', thresholds: [1, 5] },
  { family: 'fixer', counter: 'modulesRepaired', thresholds: [1, 10] },
  { family: 'scavenger', counter: 'modulesDisassembled', thresholds: [1, 10] },
  { family: 'adopter', counter: 'botsAdopted', thresholds: [1] },
  { family: 'marksman', counter: 'shotsHit', thresholds: [1, 25, 250] },
  { family: 'traveller', counter: 'cellsTravelled', thresholds: [10, 100, 1_000] },
  { family: 'graduate', counter: 'tutorialsCompleted', thresholds: [1] }
]

export interface AchievementDefinition {
  id: string
  family: string
  level: number
  levels: number
  counter: Counter
  threshold: number
  isHidden: boolean
}

// One definition per level: `prospector.1`, `prospector.2`, ...; a family with a single level is just its name
export function definitionsOf(families: readonly AchievementFamily[]): AchievementDefinition[] {
  return families.flatMap(({ family, counter, thresholds, isHidden }) =>
    thresholds.map((threshold, index) => ({
      id: thresholds.length === 1 ? family : `${family}.${index + 1}`,
      family,
      level: index + 1,
      levels: thresholds.length,
      counter,
      threshold,
      isHidden: isHidden ?? false
    }))
  )
}

export const ACHIEVEMENTS: readonly AchievementDefinition[] = definitionsOf(ACHIEVEMENT_FAMILIES)
