import Redis from 'ioredis'
import { randomUUID } from 'crypto'
import { RateLimitStore } from '../application/rate-limiter'
import { RedisRateLimitStore } from './redis-rate-limit.store'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'
const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
const redis = new Redis(REDIS_URL)

afterAll(() => redis.quit())

describe('RedisRateLimitStore', () => {
  it('counts across callers within a window that ends by itself', async () => {
    const fallback: RateLimitStore = { hit: jest.fn() }
    const key = `test:${randomUUID()}`
    const nodeA = new RedisRateLimitStore(redis, fallback, logger)
    const otherConnection = new Redis(REDIS_URL)
    const nodeB = new RedisRateLimitStore(otherConnection, fallback, logger)

    expect((await nodeA.hit(key, 300)).hits).toBe(1)
    const second = await nodeB.hit(key, 300)
    expect(second.hits).toBe(2)
    expect(second.resetInMs).toBeGreaterThan(0)
    expect(second.resetInMs).toBeLessThanOrEqual(300)

    await new Promise((resolve) => setTimeout(resolve, 350))
    expect((await nodeA.hit(key, 300)).hits).toBe(1)
    expect(fallback.hit).not.toHaveBeenCalled()
    await otherConnection.quit()
  })

  it('counts on this node when Redis fails', async () => {
    const fallback: RateLimitStore = { hit: jest.fn(async () => ({ hits: 5, resetInMs: 10 })) }
    const broken = new Redis(REDIS_URL)
    jest.spyOn(broken, 'multi').mockImplementation(() => {
      throw new Error('connection lost')
    })

    await expect(new RedisRateLimitStore(broken, fallback, logger).hit('k', 100)).resolves.toEqual({
      hits: 5,
      resetInMs: 10
    })
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('connection lost'))
    broken.disconnect()
  })

  it('gives the whole window when a key has no expiry', async () => {
    const key = `test:${randomUUID()}`
    const spy = jest.spyOn(redis, 'multi')
    await redis.set(`botrts:rl:${key}`, 0)

    const hit = await new RedisRateLimitStore(redis, { hit: jest.fn() }, logger).hit(key, 500)

    expect(hit).toEqual({ hits: 1, resetInMs: 500 })
    spy.mockRestore()
    await redis.del(`botrts:rl:${key}`)
  })
})
