import {
  applyDecorators,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ApiExtension, ApiOperation } from '@nestjs/swagger'
import { Response } from 'express'
import { Observable } from 'rxjs'

export const DEPRECATION_KEY = 'apiDeprecation'

export interface Deprecation {
  // The day after which the route may be removed (a date like 2027-06-30); at least six months after the announcement
  sunset: string
  // What to use instead, as a path of the API
  replacement?: string
}

// Marks a route as deprecated (docs/product-knowledge/integrations/API.md, "Stability"): the reference shows it as deprecated, and every answer carries the
// `Deprecation` and `Sunset` headers (and a `Link` to the replacement), so a client can notice without reading the changelog
export const ApiDeprecated = (deprecation: Deprecation) =>
  applyDecorators(
    SetMetadata(DEPRECATION_KEY, deprecation),
    ApiOperation({ deprecated: true }),
    ApiExtension('x-sunset', deprecation.sunset)
  )

@Injectable()
export class DeprecationInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const deprecation = this.reflector.getAllAndOverride<Deprecation | undefined>(DEPRECATION_KEY, [
      context.getHandler(),
      context.getClass()
    ])

    if (deprecation) {
      const response = context.switchToHttp().getResponse<Response>()
      response.setHeader('Deprecation', 'true')
      response.setHeader('Sunset', new Date(`${deprecation.sunset}T00:00:00Z`).toUTCString())
      if (deprecation.replacement) {
        response.setHeader('Link', `<${deprecation.replacement}>; rel="successor-version"`)
      }
    }

    return next.handle()
  }
}
