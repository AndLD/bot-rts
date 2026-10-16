import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Request, Response } from 'express'
import { IS_PUBLIC_KEY } from '../../auth/presentation/public.decorator'
import { AuthenticatedRequest } from '../../auth/presentation/auth.guard'
import { FeatureSwitchesService } from '../../featureswitches/application/feature-switches.service'
import { RateLimitHits } from '../application/rate-limit-hits'
import { CLOCK, Clock } from '../../shared/application/clock'
import { RATE_LIMITER, RateLimiter } from '../../ratelimit/application/rate-limiter'
import { TooManyRequestsError } from '../../shared/domain/errors'
import { ApiKeyIpNotAllowedError, ApiKeyScopeError, SessionOnlyError } from '../domain/api-key.errors'
import { REQUIRED_SCOPE_KEY, ScopeRequirement, SESSION_ONLY_KEY } from './scope.decorator'

const MINUTE_MS = 60_000

// Runs after authentication. A session passes untouched. An API key passes only on a route that names a scope the key has, and
// only within its own rate limit; a route that names no scope is closed to keys (deny by default), so a new route is never
// reachable by a key until someone decides which scope it needs.
@Injectable()
export class ApiAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
    private readonly hits: RateLimitHits,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly features: FeatureSwitchesService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()]
    if (this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, targets)) {
      return true
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const grant = request.principal?.apiKey
    if (!grant) {
      return true
    }
    // Switching the public API off stops every key at once; sessions are not affected
    await this.features.assertEnabled('publicApi')

    if (this.reflector.getAllAndOverride<boolean | undefined>(SESSION_ONLY_KEY, targets)) {
      throw new SessionOnlyError()
    }
    const requirement = this.reflector.getAllAndOverride<ScopeRequirement | undefined>(REQUIRED_SCOPE_KEY, targets)
    if (!requirement) {
      throw new SessionOnlyError()
    }
    const scope = typeof requirement === 'string' ? requirement : requirement(request as Request)
    if (!grant.scopes.includes(scope)) {
      throw new ApiKeyScopeError(scope)
    }
    // An admin key may be tied to addresses (design §25.2)
    if (grant.ipAllowList?.length && (!request.ip || !grant.ipAllowList.includes(request.ip))) {
      throw new ApiKeyIpNotAllowedError()
    }

    const response = context.switchToHttp().getResponse<Response>()
    try {
      const decision = await this.limiter.consume('key', grant.id, { limit: grant.ratePerMinute, windowMs: MINUTE_MS })
      response.setHeader('X-RateLimit-Limit', decision.limit)
      response.setHeader('X-RateLimit-Remaining', decision.remaining)
    } catch (error) {
      if (error instanceof TooManyRequestsError) {
        this.hits.record(grant.id, this.clock.now().getTime())
        response.setHeader('Retry-After', error.retryAfterSeconds)
      }
      throw error
    }

    return true
  }
}
