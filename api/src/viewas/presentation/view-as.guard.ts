import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthenticatedRequest } from '../../auth/presentation/auth.guard'
import { ViewAsReadOnlyError } from '../../auth/domain/view-as.errors'
import { ALLOW_IN_VIEW_AS_KEY } from './view-as.decorator'

const READ_METHODS = ['GET', 'HEAD', 'OPTIONS']

// Runs after authentication. A "view as player" session may only read: every other request is refused on the server, whatever
// the screen sends (design §25.2).
@Injectable()
export class ViewAsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()

    if (!request.principal?.viewAs || READ_METHODS.includes(request.method)) {
      return true
    }
    if (
      this.reflector.getAllAndOverride<boolean | undefined>(ALLOW_IN_VIEW_AS_KEY, [
        context.getHandler(),
        context.getClass()
      ])
    ) {
      return true
    }

    throw new ViewAsReadOnlyError()
  }
}
