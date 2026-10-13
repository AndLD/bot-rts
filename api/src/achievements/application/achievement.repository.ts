import type { Counter } from '../domain/achievement-definitions'

export const ACHIEVEMENT_REPOSITORY = Symbol('AchievementRepository')

export interface AchievementUnlockRecord {
  achievementId: string
  unlockedAt: Date
}

// Where the counters and the unlocks of the players are kept (design §23.1): per player, not per base
export interface AchievementRepository {
  // Adds to the counters and gives the totals they have now
  addToCounters(userId: string, deltas: Partial<Record<Counter, number>>): Promise<Partial<Record<Counter, number>>>
  counters(userId: string): Promise<Partial<Record<Counter, number>>>
  unlocks(userId: string): Promise<AchievementUnlockRecord[]>
  // Records an unlock; false when the player already had it, so it is announced once even when two events race
  unlock(userId: string, achievementId: string, at: Date): Promise<boolean>
}
