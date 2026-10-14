import { Socket } from 'socket.io'
import { API_SCOPES } from '../../../../lib/utils/interfaces/api-keys'
import { RateLimiter } from '../../ratelimit/application/rate-limiter'
import { TooManyRequestsError } from '../../shared/domain/errors'
import { guardKeySocket, SOCKET_EVENT_SCOPES } from './socket-key-guard'

type Middleware = (packet: unknown[], next: () => void) => Promise<void>

function connect(apiKey: unknown, consume: jest.Mock = jest.fn(async () => undefined)) {
  let middleware: Middleware | undefined
  const socket = { principal: { apiKey }, use: (fn: Middleware) => (middleware = fn) } as unknown as Socket
  guardKeySocket(socket, { consume } as unknown as RateLimiter)
  const send = async (event: string, ...args: unknown[]) => {
    const next = jest.fn()
    await middleware?.([event, ...args], next)
    return next
  }
  return { send, installed: () => middleware !== undefined, consume }
}

describe('guardKeySocket', () => {
  it('does nothing for a session', () => {
    expect(connect(undefined).installed()).toBe(false)
  })

  it('passes an event whose scope the key has, within its rate limit', async () => {
    const { send, consume } = connect({ id: 'k1', scopes: ['read'], ratePerMinute: 30 })

    const next = await send('get-map', {}, jest.fn())

    expect(next).toHaveBeenCalledTimes(1)
    expect(consume).toHaveBeenCalledWith('key', 'k1', { limit: 30, windowMs: 60_000 })
  })

  it('answers an event without the scope through its acknowledgement, and never lets the handler see it', async () => {
    const { send } = connect({ id: 'k1', scopes: ['read'], ratePerMinute: 30 })
    const ack = jest.fn()

    const next = await send('craft-module', 'base', 'gun', 1, ack)

    expect(next).not.toHaveBeenCalled()
    expect(ack).toHaveBeenCalledWith(null, { code: 403, msg: expect.stringContaining('fabrication') })
  })

  it('refuses an event the game does not know, and one over the rate limit', async () => {
    const consume = jest.fn().mockRejectedValue(new TooManyRequestsError(3))
    const { send } = connect({ id: 'k1', scopes: ['read'], ratePerMinute: 1 }, consume)
    const unknown = jest.fn()
    const limited = jest.fn()

    expect((await send('hack-the-planet', unknown)).mock.calls).toHaveLength(0)
    expect((await send('get-map', {}, limited)).mock.calls).toHaveLength(0)

    expect(unknown).toHaveBeenCalledWith(null, expect.objectContaining({ code: 403 }))
    expect(limited).toHaveBeenCalledWith(null, expect.objectContaining({ code: 429 }))
  })

  it('drops a refused event that has no acknowledgement without failing', async () => {
    const { send } = connect({ id: 'k1', scopes: [], ratePerMinute: 1 })

    await expect(send('get-map', {})).resolves.toBeDefined()
  })

  it('knows a scope that exists for every event of the game client', () => {
    for (const scope of Object.values(SOCKET_EVENT_SCOPES)) {
      expect(API_SCOPES).toContain(scope)
    }
  })
})
