import { ConfiguredIoAdapter } from './configured-io.adapter'
import { Logger } from '../application/logger'
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

describe('ConfiguredIoAdapter', () => {
  it('takes the CORS origin from the configuration', () => {
    const adapter = new ConfiguredIoAdapter({ get: jest.fn(), resolve: jest.fn() } as never, 'https://play.example')
    const create = jest
      .spyOn(Object.getPrototypeOf(ConfiguredIoAdapter.prototype), 'createIOServer')
      .mockReturnValue({} as never)

    adapter.createIOServer(0, { path: '/x' } as never)

    expect(create).toHaveBeenCalledWith(0, { path: '/x', cors: { origin: 'https://play.example', credentials: true } })
  })
})
