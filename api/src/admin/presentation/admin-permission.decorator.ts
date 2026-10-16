import { applyDecorators, SetMetadata } from '@nestjs/common'
import { ApiExtension } from '@nestjs/swagger'
import { AdminPermission } from '../../../../lib/utils/admin'
import { AdminApiScope } from '../../../../lib/utils/admin-api-keys'
import { REQUIRED_SCOPE_KEY, SessionOnly } from '../../apikeys/presentation/scope.decorator'

export const ADMIN_PERMISSION_KEY = 'adminPermission'
export const ADMIN_ONLY_KEY = 'adminOnly'
export const AUDIT_KEY = 'adminAudit'

export interface PermissionOptions {
  // Opens the route to an admin API key that holds this read scope (design §25.2). Without it, admin routes are closed to keys.
  adminKeyScope?: AdminApiScope
}

// What a route needs from the admin: a permission of the role, and a session that passed the second factor. A route that names an
// admin key scope can also be called with an admin API key; the owner of the key must still hold the permission on every call.
export const RequirePermission = (permission: AdminPermission, options: PermissionOptions = {}) =>
  applyDecorators(
    SetMetadata(ADMIN_PERMISSION_KEY, permission),
    ApiExtension('x-admin-permission', permission),
    // The public spec says "session only" either way: the admin scopes are described in the admin documentation only
    options.adminKeyScope
      ? applyDecorators(
          SetMetadata(REQUIRED_SCOPE_KEY, options.adminKeyScope),
          ApiExtension('x-api-key-scope', 'none (session only)')
        )
      : SessionOnly()
  )

// A route for any admin role that may be used before the second factor is verified (enrolling and verifying it)
export const AdminSecondFactorRoute = () =>
  applyDecorators(
    SetMetadata(ADMIN_ONLY_KEY, true),
    ApiExtension('x-admin-permission', 'any admin role'),
    SessionOnly()
  )

export interface AuditOptions {
  // The dotted action name written to the trail; sensitive reads (a player's files) name it too
  action: string
  targetType?: string
  // The route parameter that holds the id of the target
  targetParam?: string
}

// Writes an audit entry for the call. Every non-GET call under /admin is audited even without this (with the method and
// route as its action); a GET is audited only when it reads sensitive data and says so here.
export const Audited = (options: AuditOptions) => SetMetadata(AUDIT_KEY, options)
