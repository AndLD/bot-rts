import { EventEmitter } from 'events'
import { ConfiguredIoAdapter } from './configured-io.adapter'
import { Logger } from '../application/logger'
import { FakeClock } from '../../../tests/fakes/fakes'
import { ApiActivity } from '../application/api-activity'
import { NO_TRACING } from '../application/tracing'
import { AppError } from '../domain/app-error'
import { guarded, toSocketError } from './socket-handlers'

describe('toSocketError', () => {
  it('keeps the status and message of an AppError and hides everything else', () => {
    expect(toSocketError(new AppError(403, 'FORBIDDEN', 'No'))).toEqual({ code: 403, msg: 'No' })
    expect(toSocketError(new Error('secret'))).toEqual({ code: 500, msg: 'INTERNAL_ERROR' })
  })
})

describe('guarded', () => {
  const logger = (): jest.Mocked<Logger> => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })

  it('passes the payload without the acknowledgement to the handler', async () => {
    const handler = jest.fn().mockResolvedValue(undefined)

    guarded(logger(), handler)('a', 'b', jest.fn())
    await new Promise((resolve) => setImmediate(resolve))

    expect(handler).toHaveBeenCalledWith(expect.any(Function), 'a', 'b')
  })

  it('does not log expected errors', async () => {
    const log = logger()
    const ack = jest.fn()

    guarded(log, () => Promise.reject(new AppError(404, 'NOT_FOUND', 'Gone')))(ack)
    await new Promise((resolve) => setImmediate(resolve))

    expect(ack).toHaveBeenCalledWith(null, { code: 404, msg: 'Gone' })
    expect(log.error).not.toHaveBeenCalled()
  })
})

describe('ConfiguredIoAdapter sockets', () => {
  it("tells the traffic counters when a player's socket opens and closes", () => {
    const activity = new ApiActivity()
    const clock = new FakeClock()
    const server = new EventEmitter()
    const create = jest
      .spyOn(Object.getPrototypeOf(ConfiguredIoAdapter.prototype), 'createIOServer')
      .mockReturnValue(Object.assign(server, { adapter: jest.fn() }) as never)
    new ConfiguredIoAdapter(
      { get: jest.fn(), resolve: jest.fn() } as never,
      () => true,
      NO_TRACING,
      activity,
      clock
    ).createIOServer(0)
    const socket = Object.assign(new EventEmitter(), { principal: { user: { id: 'alice' } }, use: jest.fn() })

    server.emit('connection', socket)
    expect(activity.snapshot()).toMatchObject({ socketsOpen: 1, onlinePlayers: 1 })
    socket.emit('disconnect')

    expect(activity.snapshot()).toMatchObject({ socketsOpen: 0, onlinePlayers: 0 })
    create.mockRestore()
  })
})

describe('ConfiguredIoAdapter', () => {
  it('takes the CORS origins from the configuration', () => {
    const allowed = (origin: string | undefined) => origin === 'https://play.example'
    const adapter = new ConfiguredIoAdapter(
      { get: jest.fn(), resolve: jest.fn() } as never,
      allowed,
      NO_TRACING,
      new ApiActivity(),
      new FakeClock()
    )
    const create = jest
      .spyOn(Object.getPrototypeOf(ConfiguredIoAdapter.prototype), 'createIOServer')
      .mockReturnValue({ on: jest.fn() } as never)

    adapter.createIOServer(0, { path: '/x' } as never)

    const options = create.mock.calls[0][1] as {
      cors: { origin: (origin: string, callback: (error: Error | null, allow: boolean) => void) => void }
    }
    expect(options).toMatchObject({ path: '/x', cors: { credentials: true } })
    const answers: unknown[] = []
    options.cors.origin('https://play.example', (error: Error | null, allow: boolean) => answers.push([error, allow]))
    options.cors.origin('https://evil.example', (error: Error | null, allow: boolean) => answers.push([error, allow]))
    expect(answers).toEqual([
      [null, true],
      [null, false]
    ])
  })
})
