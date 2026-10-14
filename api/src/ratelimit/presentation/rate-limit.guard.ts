import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Request, Response } from 'express'
import { APP_CONFIG, AppConfig } from '../../config/app-config'
import { TooManyRequestsError } from '../../shared/domain/errors'
import { RATE_LIMITER, RateLimiter, RateLimitRule } from '../application/rate-limiter'
import { RATE_LIMIT_BUCKET_KEY, RateLimitBucket } from './rate-limit.decorator'

// Registered globally and ahead of authentication, so an unauthenticated flood is stopped before any work is done
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly rules: Record<Exclude<RateLimitBucket, 'none'>, RateLimitRule>

  constructor(
    private readonly reflector: Reflector,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
    @Inject(APP_CONFIG) config: AppConfig
  ) {
    const { windowMs, authMax, apiWindowMs, apiMax } = config.rateLimit
    this.rules = { auth: { limit: authMax, windowMs }, api: { limit: apiMax, windowMs: apiWindowMs } }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const bucket =
      this.reflector.getAllAndOverride<RateLimitBucket | undefined>(RATE_LIMIT_BUCKET_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? 'api'

    if (bucket === 'none') {
      return true
    }

    const request = context.switchToHttp().getRequest<Request>()
    const response = context.switchToHttp().getResponse<Response>()

    try {
      const decision = await this.limiter.consume(bucket, request.ip ?? 'unknown', this.rules[bucket])
      response.setHeader('X-RateLimit-Limit', decision.limit)
      response.setHeader('X-RateLimit-Remaining', decision.remaining)
    } catch (error) {
      if (error instanceof TooManyRequestsError) {
        response.setHeader('Retry-After', error.retryAfterSeconds)
      }
      throw error
    }

    return true
  }
}
