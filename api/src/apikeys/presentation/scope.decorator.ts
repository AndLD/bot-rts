import { applyDecorators, SetMetadata } from '@nestjs/common'
import { ApiExtension } from '@nestjs/swagger'
import type { Request } from 'express'
import { GrantedScope } from '../../../../lib/utils/admin-api-keys'

export const REQUIRED_SCOPE_KEY = 'apiKeyScope'
export const SESSION_ONLY_KEY = 'apiKeySessionOnly'

// What a route needs from an API key: one scope, or a function that reads it from the request (a manual action needs the scope of
// its category). A session (the official client) is not asked for scopes.
export type ScopeRequirement = GrantedScope | ((request: Request) => GrantedScope)

// A route reachable by an API key with this scope. A route with neither this nor @SessionOnly() is closed to keys.
export const RequireScope = (scope: ScopeRequirement) =>
  applyDecorators(
    SetMetadata(REQUIRED_SCOPE_KEY, scope),
    ApiExtension('x-api-key-scope', typeof scope === 'string' ? scope : 'depends on the request')
  )

// A route that only a signed-in session may use: account and key management, settings, administration
export const SessionOnly = () =>
  applyDecorators(SetMetadata(SESSION_ONLY_KEY, true), ApiExtension('x-api-key-scope', 'none (session only)'))
