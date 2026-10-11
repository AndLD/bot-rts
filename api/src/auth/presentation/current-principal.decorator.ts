import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { Principal } from '../application/auth.service'
import { AuthenticatedRequest } from './auth.guard'

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().principal
)
