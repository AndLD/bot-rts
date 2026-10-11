import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ForbiddenError } from '../../shared/domain/errors'
import { isAdmin } from '../../users/domain/user-access'
import { AuthenticatedRequest } from './auth.guard'
import { RequiredRole, ROLE_KEY } from './roles.decorator'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RequiredRole | undefined>(ROLE_KEY, [
      context.getHandler(),
      context.getClass()
    ])

    if (!required) {
      return true
    }

    const status = context.switchToHttp().getRequest<AuthenticatedRequest>().principal.user.status

    if (required === 'owner' ? status !== 'owner' : !isAdmin(status)) {
      throw new ForbiddenError()
    }

    return true
  }
}
