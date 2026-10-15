import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AdminPermission, hasPermission, isAdminRole } from '../../../../lib/utils/admin'
import { APP_CONFIG, AppConfig } from '../../config/app-config'
import { ViewAsReadOnlyError } from '../../auth/domain/view-as.errors'
import { ForbiddenError } from '../../shared/domain/errors'
import { AdminIpNotAllowedError, TwoFactorRequiredError } from '../domain/admin.errors'
import { AuditService } from '../application/audit.service'
import { SecondFactorService } from '../application/second-factor.service'
import { ADMIN_ONLY_KEY, ADMIN_PERMISSION_KEY } from './admin-permission.decorator'
import { AdminRequest } from './admin-request'

// Runs after authentication and the API-key check. Guards the routes that name an admin permission: the caller must hold an
// admin role that includes it, come from an allowed address, and have passed the second factor in this session. A refusal is
// written to the audit trail.
@Injectable()
export class AdminAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly secondFactor: SecondFactorService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()]
    const permission = this.reflector.getAllAndOverride<AdminPermission | undefined>(ADMIN_PERMISSION_KEY, targets)
    const isAnyAdminRoute = this.reflector.getAllAndOverride<boolean | undefined>(ADMIN_ONLY_KEY, targets)

    if (!permission && !isAnyAdminRoute) {
      return true
    }

    const request = context.switchToHttp().getRequest<AdminRequest>()
    const { user, identity } = request.principal

    // A view of a player's game is for the game's screens only; the console never opens in it, whoever the player is
    if (request.principal.viewAs) {
      throw new ViewAsReadOnlyError()
    }

    try {
      this.assertAddressAllowed(request.ip)
      if (!isAdminRole(user.status) || (permission && !hasPermission(user.status, permission))) {
        throw new ForbiddenError()
      }
      if (permission && !(await this.secondFactor.isSessionVerified(identity.sessionId))) {
        throw new TwoFactorRequiredError()
      }
    } catch (error) {
      await this.audit.record({
        actorId: user.id,
        actorRole: user.status,
        action: permission ?? 'admin.access',
        outcome: 'denied',
        targetType: null,
        targetId: null,
        reason: (error as Error).message,
        before: null,
        after: null,
        ip: request.ip ?? null,
        requestId: null
      })
      throw error
    }

    return true
  }

  private assertAddressAllowed(ip: string | undefined): void {
    const allowed = this.config.admin.ipAllowList

    if (allowed.length && (!ip || !allowed.includes(ip))) {
      throw new AdminIpNotAllowedError()
    }
  }
}
