import { Server, Socket } from 'socket.io'
import { EngineEvent } from '../application/engine-ports'
import { RealtimeGateway, roomOf } from './realtime.gateway'

function setup() {
  let listener: (event: EngineEvent) => void = () => undefined
  const off = jest.fn()
  const engine = {
    onEvent: (l: (event: EngineEvent) => void) => {
      listener = l
      return off
    }
  }
  const emitted: Array<{ room: string; event: string; payload: unknown }> = []
  const server = {
    to: (room: string) => ({ emit: (event: string, payload: unknown) => emitted.push({ room, event, payload }) })
  } as unknown as Server
  const gateway = new RealtimeGateway(engine as never)
  return { gateway, server, emitted, emit: (e: EngineEvent) => listener(e), off }
}

describe('RealtimeGateway', () => {
  it('puts the connections of a player in their room', () => {
    const { gateway } = setup()
    const join = jest.fn()

    gateway.handleConnection({ principal: { user: { id: 'alice' } }, join } as unknown as Socket)

    expect(join).toHaveBeenCalledWith(roomOf('alice'))
  })

  it('pushes the events of the engine to the room of the player they are for', () => {
    const { gateway, server, emitted, emit } = setup()
    gateway.afterInit(server)

    emit({ type: 'radio', userId: 'alice', changes: [{ botId: 'b', isConnected: false, bars: 0, hops: 0 }] })
    emit({ type: 'vision', userId: 'bob', botId: 'b', scannerId: 's', tick: 3, cells: [] })
    emit({
      type: 'execution',
      userId: 'alice',
      execution: { id: 'e', botId: 'b', file: '/m/a.js', args: [], state: 'queued', reason: null, restarts: 0 }
    })
    emit({ type: 'log', executionId: 'e', botId: 'b', userId: 'alice', kind: 'output', text: 'hi' })

    expect(emitted.map((e) => [e.room, e.event])).toEqual([
      ['user:alice', 'radio-changes'],
      ['user:bob', 'vision'],
      ['user:alice', 'execution'],
      ['user:alice', 'script-log']
    ])
    expect(emitted[3].payload).toMatchObject({ text: 'hi' })
  })

  it('sends a game event to a consumer call, not to the forwarding', () => {
    const { gateway, server, emitted, emit } = setup()
    gateway.afterInit(server)
    const event = { type: 'EnergyLow' as const, at: 1, parties: [{ userId: 'alice', botId: 'b' }] as [never] }

    emit({ type: 'game', userId: 'alice', event })
    expect(emitted).toEqual([])
    gateway.consume('alice', event)

    expect(emitted).toEqual([{ room: 'user:alice', event: 'game-event', payload: event }])
  })

  it('pushes something that is not a game event of the engine to the room of a player', () => {
    const { gateway, server, emitted } = setup()

    gateway.push('alice', 'achievement-unlocked', {
      id: 'firstSteps',
      family: 'firstSteps',
      level: 1,
      levels: 1,
      threshold: 1,
      unlockedAt: 5
    })
    gateway.afterInit(server)
    gateway.push('alice', 'achievement-unlocked', {
      id: 'firstSteps',
      family: 'firstSteps',
      level: 1,
      levels: 1,
      threshold: 1,
      unlockedAt: 5
    })

    expect(emitted).toEqual([expect.objectContaining({ room: 'user:alice', event: 'achievement-unlocked' })])
  })

  it('says nothing before the server exists and stops listening on shutdown', () => {
    const { gateway, off } = setup()

    gateway.consume('alice', { type: 'EnergyLow', at: 1, parties: [{ userId: 'alice', botId: 'b' }] })
    gateway.onApplicationShutdown()
    gateway.afterInit({ to: jest.fn() } as unknown as Server)
    gateway.onApplicationShutdown()

    expect(off).toHaveBeenCalledTimes(1)
  })
})
