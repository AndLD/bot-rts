import { Namespace, Socket } from 'socket.io'
import { buildUser } from '../../../tests/integration/builders'
import { MonitoringService } from '../application/monitoring.service'
import { MonitoringGateway } from './monitoring.gateway'

function setup() {
  let listener: (health: never) => void = () => undefined
  const off = jest.fn()
  const monitoring = {
    onSample: (l: (health: never) => void) => ((listener = l), off),
    health: () => ({ sampledAt: new Date(5), status: 'green', areas: [], alerts: [] })
  } as unknown as MonitoringService
  const emitted: Array<{ room: string; event: string }> = []
  const namespace = {
    to: (room: string) => ({ emit: (event: string) => emitted.push({ room, event }) })
  } as unknown as Namespace
  const gateway = new MonitoringGateway(monitoring)
  gateway.afterInit(namespace)

  return {
    gateway,
    emitted,
    sample: () => listener({ sampledAt: null, status: 'green', areas: [], alerts: [] } as never),
    off
  }
}

const socketOf = (status: 'analyst' | 'user') =>
  ({ principal: { user: buildUser({ status }) }, join: jest.fn(), emit: jest.fn() }) as unknown as Socket & {
    join: jest.Mock
    emit: jest.Mock
  }

describe('MonitoringGateway', () => {
  it('puts a console that may see the dashboard in the room and sends the report at once', () => {
    const { gateway } = setup()
    const socket = socketOf('analyst')

    gateway.handleConnection(socket)

    expect(socket.join).toHaveBeenCalledWith('monitoring')
    expect(socket.emit).toHaveBeenCalledWith('monitoring-health', expect.objectContaining({ sampledAt: 5 }))
  })

  it('leaves out an account that may not see the dashboard', () => {
    const { gateway } = setup()
    const socket = socketOf('user')

    gateway.handleConnection(socket)

    expect(socket.join).not.toHaveBeenCalled()
    expect(socket.emit).not.toHaveBeenCalled()
  })

  it('broadcasts each sample to the room and stops on shutdown', () => {
    const { gateway, emitted, sample, off } = setup()

    sample()
    gateway.onApplicationShutdown()

    expect(emitted).toEqual([{ room: 'monitoring', event: 'monitoring-health' }])
    expect(off).toHaveBeenCalled()
  })
})
