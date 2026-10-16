import { TooManyRequestsError } from '../../shared/domain/errors'
import { MemoryRateLimitStore } from '../infrastructure/memory-rate-limit.store'
import { RateLimiter } from './rate-limiter'

class TestClock {
  constructor(public time = 0) {}
  now() {
    return new Date(this.time)
  }
}

const rule = { limit: 2, windowMs: 10_000 }

describe('RateLimiter', () => {
  it('lets the limit through, then refuses until the window ends', async () => {
    const clock = new TestClock(1_000)
    const limiter = new RateLimiter(new MemoryRateLimitStore(clock))

    await expect(limiter.consume('auth', '1.1.1.1', rule)).resolves.toEqual({
      limit: 2,
      remaining: 1,
      resetInSeconds: 10
    })
    await expect(limiter.consume('auth', '1.1.1.1', rule)).resolves.toMatchObject({ remaining: 0 })
    clock.time += 4_000
    await expect(limiter.consume('auth', '1.1.1.1', rule)).rejects.toMatchObject({
      statusCode: 429,
      code: 'TOO_MANY_REQUESTS',
      retryAfterSeconds: 6
    })

    clock.time += 6_000
    await expect(limiter.consume('auth', '1.1.1.1', rule)).resolves.toMatchObject({ remaining: 1 })
  })

  it('tells the traffic counters of every request it refuses', async () => {
    const rateLimitHit = jest.fn()
    const limiter = new RateLimiter(new MemoryRateLimitStore(new TestClock()), { rateLimitHit })

    await limiter.consume('api', 'a', { limit: 1, windowMs: 1000 })
    expect(rateLimitHit).not.toHaveBeenCalled()
    await expect(limiter.consume('api', 'a', { limit: 1, windowMs: 1000 })).rejects.toBeInstanceOf(TooManyRequestsError)
    await expect(limiter.consume('api', 'a', { limit: 1, windowMs: 1000 })).rejects.toBeInstanceOf(TooManyRequestsError)

    expect(rateLimitHit).toHaveBeenCalledTimes(2)
  })

  it('counts each bucket and subject on its own', async () => {
    const limiter = new RateLimiter(new MemoryRateLimitStore(new TestClock()))

    await limiter.consume('auth', 'a', { limit: 1, windowMs: 1000 })

    await expect(limiter.consume('auth', 'b', { limit: 1, windowMs: 1000 })).resolves.toBeDefined()
    await expect(limiter.consume('api', 'a', { limit: 1, windowMs: 1000 })).resolves.toBeDefined()
    await expect(limiter.consume('auth', 'a', { limit: 1, windowMs: 1000 })).rejects.toBeInstanceOf(
      TooManyRequestsError
    )
  })

  it('forgets expired windows when the store grows large', async () => {
    const clock = new TestClock()
    const store = new MemoryRateLimitStore(clock)
    for (let i = 0; i < 10_001; i += 1) {
      await store.hit(`k${i}`, 1000)
    }
    clock.time += 2000

    await expect(store.hit('fresh', 1000)).resolves.toEqual({ hits: 1, resetInMs: 1000 })
    expect(await store.hit('k0', 1000)).toEqual({ hits: 1, resetInMs: 1000 })
  })
})
