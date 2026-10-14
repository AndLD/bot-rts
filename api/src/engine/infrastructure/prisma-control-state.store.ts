import { Prisma } from '@prisma/client'
import { Clock } from '../../shared/application/clock'
import { ControlStateStore } from '../application/control-state'
import { ControlState, INITIAL_CONTROL_STATE } from '../domain/engine-control'

const KEY = 'engine.control'

// The control state as one row of the game settings
export class PrismaControlStateStore implements ControlStateStore {
  constructor(
    private readonly db: Prisma.TransactionClient,
    private readonly clock: Clock
  ) {}

  async load(): Promise<ControlState> {
    const row = await this.db.gameSetting.findUnique({ where: { key: KEY } })
    const stored = (row?.value ?? {}) as Partial<ControlState>

    return {
      isPaused: stored.isPaused ?? INITIAL_CONTROL_STATE.isPaused,
      areScriptsHalted: stored.areScriptsHalted ?? INITIAL_CONTROL_STATE.areScriptsHalted,
      quarantined: stored.quarantined ?? []
    }
  }

  async save(state: ControlState): Promise<void> {
    const value = state as unknown as Prisma.InputJsonValue

    await this.db.gameSetting.upsert({
      where: { key: KEY },
      create: { key: KEY, value, updatedAt: this.clock.now() },
      update: { value, updatedAt: this.clock.now() }
    })
  }
}
