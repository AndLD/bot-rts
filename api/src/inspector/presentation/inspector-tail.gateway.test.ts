import { Namespace, Socket } from 'socket.io'
import { buildUser } from '../../../tests/integration/builders'
import { EngineEvent } from '../../engine/application/engine-ports'
import { InspectorTailGateway } from './inspector-tail.gateway'

function setup() {
  let listener: (event: EngineEvent) => void = () => undefined
  const off = jest.fn()
  const engine = { onEvent: (l: (event: EngineEvent) => void) => ((listener = l), off) }
  const emitted: Array<{ room: string; event: string; payload: unknown }> = []
  const namespace = {
    to: (room: string) => ({ emit: (event: string, payload: unknown) => emitted.push({ room, event, payload }) })
  } as unknown as Namespace
  const gateway = new InspectorTailGateway(engine as never)
  gateway.afterInit(namespace)

  return { gateway, emitted, emit: (event: EngineEvent) => listener(event), off }
}

describe('InspectorTailGateway', () => {
  it('tells the tail room of every game event, and of nothing else', () => {
    const { emitted, emit } = setup()
    const event = { type: 'EnergyLow' as const, at: 1, parties: [{ userId: 'alice', botId: 'b' }] as [never] }

    emit({ type: 'game', userId: 'alice', event })
    emit({ type: 'radio', userId: 'alice', changes: [] })

    expect(emitted).toEqual([
      { room: 'game-event-tail', event: 'game-event-tail', payload: { userId: 'alice', event } }
    ])
  })

  it('lets only admins who may see the map listen', () => {
    const { gateway } = setup()
    const join = jest.fn()

    gateway.handleConnection({ principal: { user: buildUser({ status: 'moderator' }) }, join } as unknown as Socket)
    gateway.handleConnection({ principal: { user: buildUser({ status: 'analyst' }) }, join } as unknown as Socket)

    expect(join).toHaveBeenCalledTimes(1)
  })

  it('stops listening to the engine on shutdown', () => {
    const { gateway, off } = setup()

    gateway.onApplicationShutdown()

    expect(off).toHaveBeenCalled()
  })
})
