import { FakeScript } from '../../../tests/fakes/engine'
import { SeededRng } from '../../shared/infrastructure/seeded-rng'
import { Execution, ExecutionStatus } from '../domain/execution'
import { BotCapacities } from './bot-capacities'
import { LiveExecution } from './live-execution'
import { FairScheduler } from './scheduler'

function execution(id: string, userId: string, botId: string): LiveExecution {
  const record: Execution = {
    id,
    botId,
    userId,
    file: '/m/a.js',
    args: [],
    status: ExecutionStatus.ACTIVE,
    restarts: 0,
    reason: null,
    createdAt: new Date(0),
    endedAt: null
  }
  return new LiveExecution(record, new FakeScript(), 0)
}

function setup(seed = 1) {
  const capacities = new BotCapacities()
  const scheduler = new FairScheduler(capacities, (s) => new SeededRng(s), seed)
  const live = (id: string, user: string, bot: string, parallel = 1) => {
    capacities.set(bot, { opsPerTick: 2, parallelExecutions: parallel })
    return execution(id, user, bot)
  }
  return { capacities, scheduler, live }
}

const ids = (list: LiveExecution[]) => list.map((e) => e.record.id)

describe('FairScheduler', () => {
  it('gives every player a turn before anyone gets a second one', () => {
    const { scheduler, live } = setup()
    const executions = [
      live('a1', 'alice', 'bot-a', 3),
      live('a2', 'alice', 'bot-a', 3),
      live('a3', 'alice', 'bot-a', 3),
      live('b1', 'bob', 'bot-b'),
      live('c1', 'carol', 'bot-c')
    ]

    const order = ids(scheduler.plan(executions, 1))

    expect(order).toHaveLength(5)
    const players = order.map((id) => id[0])
    expect(new Set(players.slice(0, 3))).toEqual(new Set(['a', 'b', 'c']))
    expect(order.filter((id) => id[0] === 'a')).toEqual(['a1', 'a2', 'a3'])
  })

  it('shuffles the players the same way for the same seed and tick, and differently across ticks', () => {
    const first = setup(5)
    const second = setup(5)
    const build = (s: ReturnType<typeof setup>) =>
      ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((player) => s.live(`e-${player}`, player, `bot-${player}`))
    const a = build(first)
    const b = build(second)

    expect(ids(first.scheduler.plan(a, 7))).toEqual(ids(second.scheduler.plan(b, 7)))
    const orders = new Set(Array.from({ length: 20 }, (_, tick) => ids(first.scheduler.plan(a, tick)).join()))
    expect(orders.size).toBeGreaterThan(1)
  })

  it('serves first the players the previous tick did not reach', () => {
    const { scheduler, live } = setup()
    const executions = ['p1', 'p2', 'p3', 'p4'].map((player) => live(`e-${player}`, player, `bot-${player}`))
    const planned = scheduler.plan(executions, 1)

    scheduler.deferred(planned.slice(2))
    const next = scheduler.plan(executions, 2)

    expect(ids(next).slice(0, 2).sort()).toEqual(ids(planned.slice(2)).sort())
    scheduler.deferred([])
    expect(scheduler.plan(executions, 3)).toHaveLength(4)
  })

  it('keeps executions above the parallel limit of their bot queued', () => {
    const { scheduler, live } = setup()
    const executions = [
      live('first', 'alice', 'bot', 2),
      live('second', 'alice', 'bot', 2),
      live('third', 'alice', 'bot', 2)
    ]

    expect(ids(scheduler.plan(executions, 1))).toEqual(['first', 'second'])
    expect(ids(scheduler.plan([executions[1], executions[2]], 2))).toEqual(['second', 'third'])
  })

  it('does not run a bot that has no processor capacity', () => {
    const { scheduler, capacities, live } = setup()
    const executions = [live('a', 'alice', 'bot')]
    capacities.set('bot', { opsPerTick: 0, parallelExecutions: 0 })

    expect(scheduler.plan(executions, 1)).toEqual([])
    expect(scheduler.plan([execution('x', 'alice', 'unknown-bot')], 1)).toEqual([])
  })
})
