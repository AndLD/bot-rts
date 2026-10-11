import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Request } from 'express'
import { UnauthorizedError } from '../../shared/domain/errors'
import { AuthService, Principal } from '../application/auth.service'
import { IS_PUBLIC_KEY } from './public.decorator'

export interface AuthenticatedRequest extends Request {
  principal: Principal
}

export function readBearerToken(header: string | undefined): string | undefined {
  const [scheme, token] = (header ?? '').split(' ')

  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined
}

// Registered globally: a request needs a valid bearer token unless its route is @Public()
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])
    ) {
      return true
    }

    const request = context.switchToHttp().getRequest<Request>()
    const token = readBearerToken(request.headers.authorization)

    if (!token) {
      throw new UnauthorizedError('Authorization header is empty')
    }

    const authenticated = request as AuthenticatedRequest
    authenticated.principal = await this.auth.authenticate(token)

    return true
  }
}
