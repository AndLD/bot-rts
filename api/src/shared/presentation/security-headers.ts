import helmet, { HelmetOptions } from 'helmet'
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface'
import { ForbiddenError } from '../domain/errors'

// The security headers of the API (review of Phase 8.2). The API answers JSON, so nothing may frame or embed its
// responses; the Swagger UI under /api/docs is the only page, and it runs on the same origin.
export function helmetOptions(isProduction: boolean): HelmetOptions {
  const defaults = helmet.contentSecurityPolicy.getDefaultDirectives()

  return {
    contentSecurityPolicy: {
      directives: {
        ...defaults,
        // Plain http is normal on a development machine; production is behind TLS
        'upgrade-insecure-requests': isProduction ? [] : null
      }
    },
    // A cross-origin page may read the JSON only through CORS, which the allow-list below controls
    crossOriginResourcePolicy: { policy: 'same-site' },
    strictTransportSecurity: isProduction ? { maxAge: 15_552_000, includeSubDomains: true } : false
  }
}

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const ALLOWED_HEADERS = ['Authorization', 'Content-Type']
// What a browser client may read besides the safe headers: the rate limit state
const EXPOSED_HEADERS = ['Retry-After', 'X-RateLimit-Limit', 'X-RateLimit-Remaining']
const PREFLIGHT_CACHE_SECONDS = 600

export function corsOptions(isAllowed: (origin: string | undefined) => boolean): CorsOptions {
  return {
    origin: (origin, callback) =>
      isAllowed(origin) ? callback(null, true) : callback(new ForbiddenError('Origin is not allowed')),
    credentials: true,
    methods: ALLOWED_METHODS,
    allowedHeaders: ALLOWED_HEADERS,
    exposedHeaders: EXPOSED_HEADERS,
    maxAge: PREFLIGHT_CACHE_SECONDS
  }
}
