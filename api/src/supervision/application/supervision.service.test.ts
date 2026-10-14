import { InMemoryUserRepository } from '../../../tests/fakes/fakes'
import { InMemoryControlStateStore } from '../../../tests/fakes/engine'
import { buildUser } from '../../../tests/integration/builders'
import { EnginePort } from '../../engine/application/engine-port'
import { EngineControl, ControlState } from '../../engine/domain/engine-control'
import { ForbiddenError, NotFoundError } from '../../shared/domain/errors'
import { ActiveExecution, SupervisionReadModel } from './ports'
import { SupervisionService } from './supervision.service'

function setup() {
  const controls = new InMemoryControlStateStore()
  const users = new InMemoryUserRepository()
  const active: ActiveExecution[] = [{ id: 'e1', userId: 'u1', botId: 'b1' }]
  const readModel: SupervisionReadModel = {
    findActive: async (id) => active.find((execution) => execution.id === id) ?? null,
    countActive: async () => 5,
    countActiveOf: async (ids) => ids.length * 2
  }
  const engine = {
    kill: jest.fn(async () => ({})),
    reboot: jest.fn(async (botId: string) => (botId === 'none' ? [] : [{}, {}])),
    act: jest.fn(async () => undefined),
    control: jest.fn(async (command: EngineControl): Promise<ControlState> => {
      const next = { ...controls.state, quarantined: [...controls.state.quarantined] }
      if (command.type === 'pause' || command.type === 'resume') next.isPaused = command.type === 'pause'
      if (command.type === 'halt-scripts') next.areScriptsHalted = command.isOn
      if (command.type === 'quarantine') {
        next.quarantined = command.isOn ? [command.userId] : []
      }
      await controls.save(next)
      return next
    })
  }
  const service = new SupervisionService(engine as unknown as EnginePort, controls, readModel, users)

  return { service, engine, controls, users }
}

const moderator = { id: 'mod', status: 'admin' as const }

describe('SupervisionService', () => {
  it('shows the state with the names of quarantined players and the scripts held', async () => {
    const { service, controls, users } = setup()
    const player = buildUser({ name: 'Alice' })
    await users.add(player)
    await controls.save({ isPaused: true, areScriptsHalted: false, quarantined: [player.id, 'gone'] })

    expect(await service.state()).toEqual({
      isPaused: true,
      areScriptsHalted: false,
      quarantined: [
        { _id: player.id, name: 'Alice' },
        { _id: 'gone', name: 'gone' }
      ],
      activeExecutions: 5,
      heldExecutions: 4
    })
  })

  it('kills an active execution as its owner, and does not know another', async () => {
    const { service, engine } = setup()

    const change = await service.killExecution('e1')

    expect(engine.kill).toHaveBeenCalledWith('u1', 'e1')
    expect(change.after).toEqual({ status: 'killed' })
    await expect(service.killExecution('nope')).rejects.toThrow(NotFoundError)
  })

  it('reboots a bot and says how many scripts started again', async () => {
    const { service } = setup()

    expect((await service.rebootBot('b1')).after).toEqual({ restarted: 2 })
    expect((await service.rebootBot('none')).after).toEqual({ restarted: 0 })
  })

  it('quarantines and releases a player of a lower rank only', async () => {
    const { service, users } = setup()
    const player = buildUser()
    const boss = buildUser({ status: 'owner' })
    await users.add(player)
    await users.add(boss)

    expect(await service.setQuarantine(moderator, player.id, true)).toEqual({
      before: { isQuarantined: false },
      after: { isQuarantined: true }
    })
    expect((await service.setQuarantine(moderator, player.id, false)).after).toEqual({ isQuarantined: false })
    await expect(service.setQuarantine(moderator, boss.id, true)).rejects.toThrow(ForbiddenError)
    await expect(service.setQuarantine(moderator, 'missing', true)).rejects.toThrow(NotFoundError)
    await users.update({ ...player, deletedAt: new Date() })
    await expect(service.setQuarantine(moderator, player.id, true)).rejects.toThrow(NotFoundError)
  })

  it('pauses and resumes the world, and switches scripts off and on', async () => {
    const { service } = setup()

    expect(await service.setPaused(true)).toEqual({ before: { isPaused: false }, after: { isPaused: true } })
    expect((await service.setPaused(false)).after).toEqual({ isPaused: false })
    expect(await service.setScriptsHalted(true)).toEqual({
      before: { areScriptsHalted: false },
      after: { areScriptsHalted: true }
    })
    expect((await service.setScriptsHalted(false)).after).toEqual({ areScriptsHalted: false })
  })

  it('sends the support actions to the engine', async () => {
    const { service, engine } = setup()
    const stacks = [{ resource: 'iron', amount: 5 }] as never

    await service.grantResources('b1', stacks)
    await service.removeResources('b1', stacks)
    await service.restoreModule('b1', 'm1')

    expect(engine.act.mock.calls).toEqual([
      ['support.grantResources', ['b1', stacks]],
      ['support.removeResources', ['b1', stacks]],
      ['support.restoreModule', ['b1', 'm1']]
    ])
  })
})
