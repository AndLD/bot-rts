import Redis from 'ioredis'
import { DEFAULT_GAME_TIME_SETTINGS } from '../../../../lib/utils/game-time'
import { NotFoundError } from '../../shared/domain/errors'
import { ServiceUnavailableError } from '../../engine/domain/engine.errors'
import { EnginePort } from '../../engine/application/engine-port'
import { Logger } from '../../shared/application/logger'
import { RedisEngineBridge } from './redis-engine-bridge'
import { encode } from './engine-link'
import { RedisEnginePort } from './redis-engine-port'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

const logger: Logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
const connections: Redis[] = []
const connect = () => {
  const connection = new Redis(REDIS_URL)
  connections.push(connection)
  return connection
}

// An engine that answers each operation with what it was asked, so the test sees every argument arrive
type EchoEngine = Record<keyof EnginePort, jest.Mock> & EnginePort

function echoEngine(): EchoEngine {
  return {
    start: jest.fn(async (request) => ({ started: request }) as never),
    kill: jest.fn(async (userId, executionId) => ({ killed: [userId, executionId] }) as never),
    list: jest.fn(async (userId) => [{ listed: userId }] as never),
    act: jest.fn(async (name, args) => ({ name, args, at: new Date('2026-01-02T03:04:05Z') }) as never),
    manual: jest.fn(async (...args) => args as never),
    linkStatus: jest.fn(async (userId, botId) => ({ userId, botId }) as never),
    metrics: jest.fn(async () => ({ ticks: 7 }) as never),
    control: jest.fn(async (command) => ({ controlled: command }) as never),
    setGameTime: jest.fn(async () => undefined),
    reboot: jest.fn(async (botId) => [{ rebooted: botId }] as never),
    top: jest.fn(async (limit) => [{ top: limit }] as never),
    onEvent: jest.fn(() => () => undefined)
  } as unknown as EchoEngine
}

afterEach(async () => {
  await Promise.all(connections.splice(0).map((connection) => connection.quit()))
})

async function link(engine: EnginePort, timeoutMs = 2000) {
  const bridge = new RedisEngineBridge(engine, connect(), connect(), logger)
  await bridge.open()
  const port = new RedisEnginePort(connect(), connect(), timeoutMs)
  await port.open()
  return port
}

describe('the engine link over Redis', () => {
  it('carries every operation to the engine node and brings the answer back, dates included', async () => {
    const engine = echoEngine()
    const port = await link(engine)

    await expect(port.start({ userId: 'u' } as never)).resolves.toEqual({ started: { userId: 'u' } })
    await expect(port.kill('u', 'e')).resolves.toEqual({ killed: ['u', 'e'] })
    await expect(port.list('u')).resolves.toEqual([{ listed: 'u' }])
    await expect(port.act('craft' as never, ['a', 1] as never)).resolves.toEqual({
      name: 'craft',
      args: ['a', 1],
      at: new Date('2026-01-02T03:04:05Z')
    })
    await expect(port.manual('u', 'b', 'move', [1])).resolves.toEqual(['u', 'b', 'move', [1]])
    await expect(port.linkStatus('u', 'b')).resolves.toEqual({ userId: 'u', botId: 'b' })
    await expect(port.metrics()).resolves.toEqual({ ticks: 7 })
    await expect(port.control({ type: 'pause' })).resolves.toEqual({ controlled: { type: 'pause' } })
    await expect(port.setGameTime({ ...DEFAULT_GAME_TIME_SETTINGS, anchorMs: 5 })).resolves.toBeUndefined()
    expect(engine.setGameTime).toHaveBeenCalledWith({ ...DEFAULT_GAME_TIME_SETTINGS, anchorMs: 5 })
    await expect(port.reboot('b')).resolves.toEqual([{ rebooted: 'b' }])
    await expect(port.top(2)).resolves.toEqual([{ top: 2 }])
    port.onEvent()()
    port.close()
  })

  it('hands an application error back as the same error and a surprise as a 500', async () => {
    const engine = echoEngine()
    engine.kill.mockRejectedValueOnce(new NotFoundError('No such execution'))
    engine.list.mockRejectedValueOnce(new Error('boom'))
    const port = await link(engine)

    await expect(port.kill('u', 'e')).rejects.toMatchObject({ statusCode: 404, message: 'No such execution' })
    await expect(port.list('u')).rejects.toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR' })
    expect(logger.error).toHaveBeenCalled()
    port.close()
  })

  it('answers "unavailable" at once when no engine node listens', async () => {
    const port = new RedisEnginePort(connect(), connect(), 2000)
    await port.open()

    await expect(port.metrics()).rejects.toBeInstanceOf(ServiceUnavailableError)
    port.close()
  })

  it('answers "unavailable" when the engine node does not answer in time, and when Redis fails', async () => {
    const engine = echoEngine()
    engine.metrics.mockReturnValueOnce(new Promise(() => undefined))
    const slow = await link(engine, 50)
    await expect(slow.metrics()).rejects.toBeInstanceOf(ServiceUnavailableError)
    slow.close()

    const broken = connect()
    const port = new RedisEnginePort(broken, connect(), 2000)
    jest.spyOn(broken, 'publish').mockRejectedValueOnce(new Error('connection lost'))
    await expect(port.metrics()).rejects.toBeInstanceOf(ServiceUnavailableError)
  })

  it('fails what is still waiting when the port is closed, and ignores a late answer', async () => {
    const engine = echoEngine()
    engine.metrics.mockReturnValueOnce(new Promise(() => undefined))
    const port = await link(engine)

    const waiting = port.metrics()
    await new Promise((resolve) => setTimeout(resolve, 50))
    port.close()

    await expect(waiting).rejects.toBeInstanceOf(ServiceUnavailableError)
  })

  it('ignores an answer nobody is waiting for', async () => {
    const subscriber = connect()
    const port = new RedisEnginePort(connect(), subscriber, 2000)

    expect(() => subscriber.emit('messageBuffer', Buffer.from('x'), encode({ id: 'late', data: 1 }))).not.toThrow()
    port.close()
  })
})
