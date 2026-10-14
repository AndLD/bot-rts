import { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AppConfig } from '../../config/app-config'
import { TooManyRequestsError } from '../../shared/domain/errors'
import { RateLimiter } from '../application/rate-limiter'
import { RATE_LIMIT_BUCKET_KEY } from './rate-limit.decorator'
import { RateLimitGuard } from './rate-limit.guard'

const config = { rateLimit: { windowMs: 900, authMax: 3, apiWindowMs: 60, apiMax: 7 } } as AppConfig

function setup(bucket: string | undefined, consume: jest.Mock, ip: string | null = '9.9.9.9') {
  const headers: Record<string, unknown> = {}
  const response = { setHeader: (name: string, value: unknown) => (headers[name] = value) }
  const request = { ip: ip ?? undefined }
  const context = {
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response })
  } as unknown as ExecutionContext
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => (key === RATE_LIMIT_BUCKET_KEY ? bucket : undefined))
  }
  const guard = new RateLimitGuard(reflector as unknown as Reflector, { consume } as unknown as RateLimiter, config)
  return { guard, context, headers }
}

describe('RateLimitGuard', () => {
  it('applies the api rule by default and reports what is left', async () => {
    const consume = jest.fn(async () => ({ limit: 7, remaining: 6, resetInSeconds: 60 }))
    const { guard, context, headers } = setup(undefined, consume)

    await expect(guard.canActivate(context)).resolves.toBe(true)

    expect(consume).toHaveBeenCalledWith('api', '9.9.9.9', { limit: 7, windowMs: 60 })
    expect(headers).toEqual({ 'X-RateLimit-Limit': 7, 'X-RateLimit-Remaining': 6 })
  })

  it('counts a request without a known address under one shared subject', async () => {
    const consume = jest.fn(async () => ({ limit: 7, remaining: 6, resetInSeconds: 60 }))
    const { guard, context } = setup(undefined, consume, null)

    await guard.canActivate(context)

    expect(consume).toHaveBeenCalledWith('api', 'unknown', expect.anything())
  })

  it('applies the auth rule to routes marked for it', async () => {
    const consume = jest.fn(async () => ({ limit: 3, remaining: 2, resetInSeconds: 1 }))
    const { guard, context } = setup('auth', consume)

    await guard.canActivate(context)

    expect(consume).toHaveBeenCalledWith('auth', '9.9.9.9', { limit: 3, windowMs: 900 })
  })

  it('leaves skipped routes alone', async () => {
    const consume = jest.fn()
    const { guard, context } = setup('none', consume)

    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(consume).not.toHaveBeenCalled()
  })

  it('tells a refused client when to come back', async () => {
    const { guard, context, headers } = setup('auth', jest.fn().mockRejectedValue(new TooManyRequestsError(42)))

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(TooManyRequestsError)
    expect(headers['Retry-After']).toBe(42)
  })

  it('passes any other failure on untouched', async () => {
    const { guard, context, headers } = setup('api', jest.fn().mockRejectedValue(new Error('boom')))

    await expect(guard.canActivate(context)).rejects.toThrow('boom')
    expect(headers).toEqual({})
  })
})
