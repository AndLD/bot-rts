import type { IAchievement, IAchievementUnlock } from '../../../../lib/utils/interfaces/achievements'
import type { GameEventConsumer } from '../../engine/application/game-event-dispatcher'
import type { GameEvent } from '../../engine/domain/game-event'
import type { Clock } from '../../shared/application/clock'
import type { Logger } from '../../shared/application/logger'
import { ACHIEVEMENTS, AchievementDefinition, Counter } from '../domain/achievement-definitions'
import { countersOf } from '../domain/counting'
import type { AchievementRepository } from './achievement.repository'

type Deltas = Partial<Record<Counter, number>>
export type UnlockListener = (userId: string, unlock: IAchievementUnlock) => void

const toUnlock = (definition: AchievementDefinition, at: Date): IAchievementUnlock => ({
  id: definition.id,
  family: definition.family,
  level: definition.level,
  levels: definition.levels,
  threshold: definition.threshold,
  unlockedAt: at.getTime()
})

// Achievements (design §23): consumes the game events of the engine outside its tick path, counts what each player has done and unlocks
// the achievements whose counters are reached. Events only add to counters in memory; `flush` writes them in one batch per player, so
// a busy fleet costs a few writes and not one per move. It works for players who are not logged in: it never looks at sockets.
export class AchievementService implements GameEventConsumer {
  private pending = new Map<string, Deltas>()
  private readonly unlocked = new Map<string, Set<string>>()
  private readonly listeners = new Set<UnlockListener>()

  constructor(
    private readonly repository: AchievementRepository,
    private readonly clock: Clock,
    private readonly logger: Logger,
    private readonly definitions: readonly AchievementDefinition[] = ACHIEVEMENTS
  ) {}

  // Only the player who caused an event earns from it: others who merely saw it (a live area) hear of it too
  consume(userId: string, event: GameEvent): void {
    if (event.parties[0].userId === userId) {
      this.add(userId, countersOf(event))
    }
  }

  // For what happens outside the engine, such as finishing the tutorial
  record(userId: string, counter: Counter, amount = 1): void {
    this.add(userId, { [counter]: amount })
  }

  onUnlocked(listener: UnlockListener): () => void {
    this.listeners.add(listener)

    return () => this.listeners.delete(listener)
  }

  // Writes what was counted since the last flush and announces the unlocks
  async flush(): Promise<void> {
    const batch = this.pending
    this.pending = new Map()

    for (const [userId, deltas] of batch) {
      try {
        await this.settle(userId, deltas)
      } catch (error) {
        this.logger.error(error)
        this.add(userId, deltas)
      }
    }
  }

  // The achievements the player may see, with their progress; a hidden one only once it is unlocked
  async list(userId: string): Promise<IAchievement[]> {
    await this.flush()
    const [counters, unlocks] = await Promise.all([this.repository.counters(userId), this.repository.unlocks(userId)])
    const unlockedAt = new Map(unlocks.map((unlock) => [unlock.achievementId, unlock.unlockedAt.getTime()]))

    return this.definitions
      .filter((definition) => !definition.isHidden || unlockedAt.has(definition.id))
      .map((definition) => ({
        id: definition.id,
        family: definition.family,
        level: definition.level,
        levels: definition.levels,
        threshold: definition.threshold,
        progress: Math.min(counters[definition.counter] ?? 0, definition.threshold),
        unlockedAt: unlockedAt.get(definition.id) ?? null
      }))
  }

  private add(userId: string, deltas: Deltas): void {
    const current = this.pending.get(userId) ?? {}

    for (const [counter, amount] of Object.entries(deltas) as [Counter, number][]) {
      if (amount > 0) {
        current[counter] = (current[counter] ?? 0) + amount
      }
    }
    if (Object.keys(current).length > 0) {
      this.pending.set(userId, current)
    }
  }

  private async settle(userId: string, deltas: Deltas): Promise<void> {
    const totals = await this.repository.addToCounters(userId, deltas)
    const had = await this.unlockedOf(userId)
    const now = this.clock.now()

    for (const definition of this.definitions) {
      const total = totals[definition.counter]

      if (total === undefined || total < definition.threshold || had.has(definition.id)) {
        continue
      }
      had.add(definition.id)
      if (await this.repository.unlock(userId, definition.id, now)) {
        this.listeners.forEach((listener) => listener(userId, toUnlock(definition, now)))
      }
    }
  }

  private async unlockedOf(userId: string): Promise<Set<string>> {
    let ids = this.unlocked.get(userId)

    if (!ids) {
      ids = new Set((await this.repository.unlocks(userId)).map((unlock) => unlock.achievementId))
      this.unlocked.set(userId, ids)
    }

    return ids
  }
}
