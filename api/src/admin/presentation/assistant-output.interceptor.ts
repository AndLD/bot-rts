import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { map, Observable } from 'rxjs'
import { isAdminApiScope } from '../../../../lib/utils/admin-api-keys'
import { AuthenticatedRequest } from '../../auth/presentation/auth.guard'
import { shapeForAssistant } from '../domain/assistant-output'

// Holds what an admin API key gets back to the limits of `shapeForAssistant`; a signed-in session is not touched
@Injectable()
export class AssistantOutputInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()

    return request.principal?.apiKey?.scopes.some(isAdminApiScope)
      ? next.handle().pipe(map(shapeForAssistant))
      : next.handle()
  }
}
