import { applyDecorators, SetMetadata } from '@nestjs/common'
import { ApiExtension } from '@nestjs/swagger'
import { AdminPermission } from '../../../../lib/utils/admin'
import { SessionOnly } from '../../apikeys/presentation/scope.decorator'

export const ADMIN_PERMISSION_KEY = 'adminPermission'
export const ADMIN_ONLY_KEY = 'adminOnly'
export const AUDIT_KEY = 'adminAudit'

// What a route needs from the admin: a permission of the role, and a session that passed the second factor
export const RequirePermission = (permission: AdminPermission) =>
  applyDecorators(
    SetMetadata(ADMIN_PERMISSION_KEY, permission),
    ApiExtension('x-admin-permission', permission),
    SessionOnly()
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
