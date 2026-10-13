import { GameEvent } from '../../engine/domain/game-event'
import { AchievementDefinition, definitionsOf } from '../domain/achievement-definitions'
import { AchievementRepository, AchievementUnlockRecord } from './achievement.repository'
import { AchievementService } from './achievement.service'

type Counters = Record<string, number>

class FakeRepository implements AchievementRepository {
  counterRows = new Map<string, Counters>()
  unlockRows = new Map<string, AchievementUnlockRecord[]>()
  failNext = false

  async addToCounters(userId: string, deltas: Counters) {
    if (this.failNext) {
      this.failNext = false
      throw new Error('database is down')
    }
    const row = this.counterRows.get(userId) ?? {}
    const totals: Counters = {}
    for (const [counter, amount] of Object.entries(deltas)) {
      row[counter] = (row[counter] ?? 0) + amount
      totals[counter] = row[counter]
    }
    this.counterRows.set(userId, row)
    return totals
  }

  async counters(userId: string) {
    return { ...this.counterRows.get(userId) }
  }

  async unlocks(userId: string) {
    return [...(this.unlockRows.get(userId) ?? [])]
  }

  async unlock(userId: string, achievementId: string, at: Date) {
    const rows = this.unlockRows.get(userId) ?? []
    if (rows.some((row) => row.achievementId === achievementId)) {
      return false
    }
    this.unlockRows.set(userId, [...rows, { achievementId, unlockedAt: at }])
    return true
  }
}

const definitions: AchievementDefinition[] = definitionsOf([
  { family: 'miner', counter: 'unitsMined', thresholds: [10, 100] },
  { family: 'first', counter: 'basesDeployed', thresholds: [1] },
  { family: 'secret', counter: 'scriptRuns', thresholds: [1], isHidden: true }
])

const mined = (userId: string, amount: number, watcher = userId): [string, GameEvent] => [
  watcher,
  { type: 'ResourceMined', at: 1, parties: [{ userId, botId: 'b' }], resource: 'iron', amount }
]

function setup() {
  const repository = new FakeRepository()
  const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }
  const service = new AchievementService(
    repository,
    { now: () => new Date('2026-10-13T10:00:00Z') },
    logger as never,
    definitions
  )
  const unlocked: Array<[string, string]> = []
  service.onUnlocked((userId, unlock) => unlocked.push([userId, unlock.id]))

  return { service, repository, logger, unlocked }
}

describe('AchievementService', () => {
  it('counts what a player did and unlocks a level when its threshold is reached, once', async () => {
    const { service, unlocked } = setup()

    service.consume(...mined('alice', 6))
    await service.flush()
    expect(unlocked).toEqual([])

    service.consume(...mined('alice', 6))
    await service.flush()
    expect(unlocked).toEqual([['alice', 'miner.1']])

    service.consume(...mined('alice', 5))
    await service.flush()
    expect(unlocked).toEqual([['alice', 'miner.1']])
  })

  it('adds up the events between two flushes, and can unlock several levels at once', async () => {
    const { service, repository, unlocked } = setup()

    for (let index = 0; index < 4; index++) {
      service.consume(...mined('alice', 30))
    }
    await service.flush()

    expect(repository.counterRows.get('alice')).toEqual({ unitsMined: 120 })
    expect(unlocked.map(([, id]) => id)).toEqual(['miner.1', 'miner.2'])
  })

  it('credits only the player who caused the event, not one who saw it', async () => {
    const { service, repository } = setup()

    service.consume(...mined('alice', 50, 'bob'))
    await service.flush()

    expect(repository.counterRows.size).toBe(0)
  })

  it('counts things outside the engine, such as finishing the tutorial', async () => {
    const { service, repository } = setup()

    service.record('alice', 'basesDeployed')
    service.record('alice', 'basesDeployed', 0)
    await service.flush()

    expect(repository.counterRows.get('alice')).toEqual({ basesDeployed: 1 })
  })

  it('writes nothing when nothing was counted', async () => {
    const { service, repository } = setup()

    service.consume('alice', { type: 'EnergyLow', at: 1, parties: [{ userId: 'alice', botId: 'b' }] })
    await service.flush()

    expect(repository.counterRows.size).toBe(0)
  })

  it('does not announce an achievement the player had before this process knew of it', async () => {
    const { service, repository, unlocked } = setup()
    await repository.unlock('alice', 'miner.1', new Date(0))

    service.consume(...mined('alice', 20))
    await service.flush()

    expect(unlocked).toEqual([])
  })

  it('announces an unlock once even when another process won the race to record it', async () => {
    const { service, repository, unlocked } = setup()
    jest.spyOn(repository, 'unlock').mockResolvedValue(false)

    service.consume(...mined('alice', 20))
    await service.flush()

    expect(unlocked).toEqual([])
  })

  it('keeps what it counted when the database fails, and writes it at the next flush', async () => {
    const { service, repository, logger, unlocked } = setup()
    repository.failNext = true

    service.consume(...mined('alice', 20))
    await service.flush()
    expect(logger.error).toHaveBeenCalled()

    await service.flush()
    expect(unlocked).toEqual([['alice', 'miner.1']])
  })

  it('stops telling a listener that unsubscribed', async () => {
    const { service } = setup()
    const heard = jest.fn()
    const off = service.onUnlocked(heard)
    off()

    service.consume(...mined('alice', 20))
    await service.flush()

    expect(heard).not.toHaveBeenCalled()
  })

  describe('list', () => {
    it('shows progress for locked achievements and the time of unlocked ones, and hides secret ones until unlocked', async () => {
      const { service } = setup()
      service.consume(...mined('alice', 15))

      const list = await service.list('alice')

      expect(list.map((item) => item.id)).toEqual(['miner.1', 'miner.2', 'first'])
      expect(list[0]).toMatchObject({ family: 'miner', level: 1, levels: 2, threshold: 10, progress: 10 })
      expect(list[0].unlockedAt).toBe(new Date('2026-10-13T10:00:00Z').getTime())
      expect(list[1]).toMatchObject({ threshold: 100, progress: 15, unlockedAt: null })
      expect(list[2]).toMatchObject({ progress: 0, unlockedAt: null })

      service.consume('alice', {
        type: 'ExecutionFinished',
        at: 1,
        parties: [{ userId: 'alice', botId: 'b' }],
        executionId: 'e'
      })
      expect((await service.list('alice')).map((item) => item.id)).toContain('secret')
    })

    it('is empty progress for a player who has done nothing', async () => {
      const { service } = setup()

      expect((await service.list('nobody')).every((item) => item.progress === 0 && item.unlockedAt === null)).toBe(true)
    })
  })
})
