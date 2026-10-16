import { ExecutionContext } from '@nestjs/common'
import { FeatureDisabledError } from '../../featureswitches/domain/feature.errors'
import { Reflector } from '@nestjs/core'
import { IS_PUBLIC_KEY } from '../../auth/presentation/public.decorator'
import { RateLimiter } from '../../ratelimit/application/rate-limiter'
import { TooManyRequestsError } from '../../shared/domain/errors'
import { RateLimitHits } from '../application/rate-limit-hits'
import { ApiAccessGuard } from './api-access.guard'
import { REQUIRED_SCOPE_KEY, SESSION_ONLY_KEY } from './scope.decorator'

interface Route {
  isPublic?: boolean
  sessionOnly?: boolean
  scope?: unknown
}

function setup(
  route: Route,
  principal: unknown,
  consume: jest.Mock = jest.fn(async () => ({ limit: 5, remaining: 4 })),
  ip: string | undefined = '9.9.9.9'
) {
  const headers: Record<string, unknown> = {}
  const request = { principal, body: { fn: 'move' }, ip }
  const context = {
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ setHeader: (name: string, value: unknown) => (headers[name] = value) })
    })
  } as unknown as ExecutionContext
  const metadata: Record<string, unknown> = {
    [IS_PUBLIC_KEY]: route.isPublic,
    [SESSION_ONLY_KEY]: route.sessionOnly,
    [REQUIRED_SCOPE_KEY]: route.scope
  }
  const reflector = { getAllAndOverride: (key: string) => metadata[key] } as unknown as Reflector
  const hits = new RateLimitHits()
  const features = { assertEnabled: jest.fn(async () => undefined) }
  const guard = new ApiAccessGuard(
    reflector,
    { consume } as unknown as RateLimiter,
    hits,
    { now: () => new Date(5000) },
    features as never
  )
  return { guard, context, headers, consume, hits, features }
}

const session = { user: { id: 'u' }, identity: {} }
const key = (scopes: string[], ratePerMinute = 5) => ({ ...session, apiKey: { id: 'k1', scopes, ratePerMinute } })

describe('ApiAccessGuard', () => {
  it('stops a key when the public API is switched off, and leaves a session alone', async () => {
    const off = new FeatureDisabledError('publicApi')
    const withKey = setup({ scope: 'read' }, key(['read']))
    withKey.features.assertEnabled.mockRejectedValue(off)
    const withSession = setup({ scope: 'read' }, session)
    withSession.features.assertEnabled.mockRejectedValue(off)

    await expect(withKey.guard.canActivate(withKey.context)).rejects.toThrow(FeatureDisabledError)
    expect(withKey.features.assertEnabled).toHaveBeenCalledWith('publicApi')
    await expect(withSession.guard.canActivate(withSession.context)).resolves.toBe(true)
  })

  it('lets a session through whatever the route says', async () => {
    for (const route of [{}, { sessionOnly: true }, { scope: 'files' }]) {
      const { guard, context, consume } = setup(route, session)
      await expect(guard.canActivate(context)).resolves.toBe(true)
      expect(consume).not.toHaveBeenCalled()
    }
  })

  it('lets everyone through a public route', async () => {
    const { guard, context } = setup({ isPublic: true }, undefined)

    await expect(guard.canActivate(context)).resolves.toBe(true)
  })

  it('lets a key through a route whose scope it has, counting the request against the rate limit of the key', async () => {
    const { guard, context, consume, headers } = setup({ scope: 'read' }, key(['read'], 7))

    await expect(guard.canActivate(context)).resolves.toBe(true)

    expect(consume).toHaveBeenCalledWith('key', 'k1', { limit: 7, windowMs: 60_000 })
    expect(headers).toEqual({ 'X-RateLimit-Limit': 5, 'X-RateLimit-Remaining': 4 })
  })

  it('refuses a key that lacks the scope', async () => {
    const { guard, context, consume } = setup({ scope: 'files' }, key(['read']))

    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'API_KEY_SCOPE', statusCode: 403 })
    expect(consume).not.toHaveBeenCalled()
  })

  it('refuses a key on a session-only route and on a route that names no scope', async () => {
    for (const route of [{ sessionOnly: true }, {}]) {
      const { guard, context } = setup(route, key(['read', 'files']))
      await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'SESSION_ONLY' })
    }
  })

  it('holds an admin key to its addresses, when it has any', async () => {
    const adminKey = (ipAllowList: string[]) => ({
      ...session,
      apiKey: { id: 'k1', scopes: ['admin:logs:read'], ratePerMinute: 5, ipAllowList }
    })
    const open = setup({ scope: 'admin:logs:read' }, adminKey([]))
    const inside = setup({ scope: 'admin:logs:read' }, adminKey(['9.9.9.9']))
    const outside = setup({ scope: 'admin:logs:read' }, adminKey(['10.0.0.1']))
    const unknown = setup({ scope: 'admin:logs:read' }, adminKey(['10.0.0.1']), undefined, null as never)

    await expect(open.guard.canActivate(open.context)).resolves.toBe(true)
    await expect(inside.guard.canActivate(inside.context)).resolves.toBe(true)
    await expect(outside.guard.canActivate(outside.context)).rejects.toMatchObject({ code: 'API_KEY_IP_NOT_ALLOWED' })
    await expect(unknown.guard.canActivate(unknown.context)).rejects.toMatchObject({ code: 'API_KEY_IP_NOT_ALLOWED' })
    expect(outside.consume).not.toHaveBeenCalled()
  })

  it('asks a function for the scope when the scope depends on the request', async () => {
    const needs = jest.fn(() => 'movement')
    const { guard, context } = setup({ scope: needs }, key(['movement']))

    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(needs).toHaveBeenCalledWith(expect.objectContaining({ body: { fn: 'move' } }))
    const refused = setup({ scope: () => 'combat' }, key(['movement']))
    await expect(refused.guard.canActivate(refused.context)).rejects.toMatchObject({ code: 'API_KEY_SCOPE' })
  })

  it('tells a key that used up its limit when to come back, and passes other failures on', async () => {
    const limited = setup({ scope: 'read' }, key(['read']), jest.fn().mockRejectedValue(new TooManyRequestsError(17)))
    await expect(limited.guard.canActivate(limited.context)).rejects.toBeInstanceOf(TooManyRequestsError)
    expect(limited.headers['Retry-After']).toBe(17)
    expect(limited.hits.since(0)).toEqual(new Map([['k1', 1]]))

    const broken = setup({ scope: 'read' }, key(['read']), jest.fn().mockRejectedValue(new Error('boom')))
    await expect(broken.guard.canActivate(broken.context)).rejects.toThrow('boom')
    expect(broken.headers['Retry-After']).toBeUndefined()
  })
})
