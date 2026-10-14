import { ISupervisionState } from '../../../../lib/utils/admin-players'
import { IResourceStack } from '../../../../lib/utils/interfaces/resources'
import { UserStatus } from '../../../../lib/utils/interfaces/users'
import { ControlStateStore } from '../../engine/application/control-state'
import { EnginePort } from '../../engine/application/engine-port'
import { assertOutranks } from '../../players/domain/player-moderation'
import { UserRepository } from '../../users/application/user.repository'
import { NotFoundError } from '../../shared/domain/errors'
import { SupervisionReadModel } from './ports'

export interface Actor {
  id: string
  status: UserStatus
}

// What an action changed, for the audit trail
export interface Change {
  before: unknown
  after: unknown
}

// The Supervision page (design §25.3): kill an execution, reboot a bot, quarantine a player, pause the world, switch scripts off,
// and the support actions. Everything that changes the world is sent to the engine, the single writer (design §14.2).
export class SupervisionService {
  constructor(
    private readonly engine: EnginePort,
    private readonly controls: ControlStateStore,
    private readonly readModel: SupervisionReadModel,
    private readonly users: UserRepository
  ) {}

  async state(): Promise<ISupervisionState> {
    const state = await this.controls.load()
    const [activeExecutions, heldExecutions, players] = await Promise.all([
      this.readModel.countActive(),
      this.readModel.countActiveOf(state.quarantined),
      Promise.all(state.quarantined.map((userId) => this.users.findById(userId)))
    ])

    return {
      isPaused: state.isPaused,
      areScriptsHalted: state.areScriptsHalted,
      quarantined: state.quarantined.map((userId, index) => ({ _id: userId, name: players[index]?.name ?? userId })),
      activeExecutions,
      heldExecutions
    }
  }

  async killExecution(executionId: string): Promise<Change> {
    const execution = await this.readModel.findActive(executionId)

    if (!execution) {
      throw new NotFoundError('No active execution with this id')
    }
    await this.engine.kill(execution.userId, executionId)

    return {
      before: { status: 'active', botId: execution.botId, userId: execution.userId },
      after: { status: 'killed' }
    }
  }

  async rebootBot(botId: string): Promise<Change> {
    const restarted = await this.engine.reboot(botId)

    return { before: null, after: { restarted: restarted.length } }
  }

  async setQuarantine(actor: Actor, userId: string, isOn: boolean): Promise<Change> {
    const player = await this.users.findById(userId)

    if (!player || player.deletedAt) {
      throw new NotFoundError('Player not found')
    }
    assertOutranks(actor, player)
    const after = await this.engine.control({ type: 'quarantine', userId, isOn })

    return { before: { isQuarantined: !isOn }, after: { isQuarantined: after.quarantined.includes(userId) } }
  }

  async setPaused(isPaused: boolean): Promise<Change> {
    const after = await this.engine.control({ type: isPaused ? 'pause' : 'resume' })

    return { before: { isPaused: !isPaused }, after: { isPaused: after.isPaused } }
  }

  async setScriptsHalted(isOn: boolean): Promise<Change> {
    const after = await this.engine.control({ type: 'halt-scripts', isOn })

    return { before: { areScriptsHalted: !isOn }, after: { areScriptsHalted: after.areScriptsHalted } }
  }

  async grantResources(botId: string, stacks: IResourceStack[]): Promise<Change> {
    await this.engine.act('support.grantResources', [botId, stacks])

    return { before: null, after: { granted: stacks } }
  }

  async removeResources(botId: string, stacks: IResourceStack[]): Promise<Change> {
    await this.engine.act('support.removeResources', [botId, stacks])

    return { before: null, after: { removed: stacks } }
  }

  async restoreModule(botId: string, moduleId: string): Promise<Change> {
    await this.engine.act('support.restoreModule', [botId, moduleId])

    return { before: null, after: { restored: moduleId } }
  }
}
