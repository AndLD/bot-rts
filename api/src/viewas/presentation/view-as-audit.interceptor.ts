import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { from, mergeMap, Observable } from 'rxjs'
import { AuditService } from '../../admin/application/audit.service'
import { AuthenticatedRequest } from '../../auth/presentation/auth.guard'
import { currentRequestId } from '../../shared/application/request-context'
import { VIEW_AS_AUDIT_KEY } from './view-as.decorator'

// Writes the audit entry of a sensitive read made in a view, before the data leaves: no such read goes without a trail
@Injectable()
export class ViewAsAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.getAllAndOverride<string | undefined>(VIEW_AS_AUDIT_KEY, [
      context.getHandler(),
      context.getClass()
    ])
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const view = request.principal?.viewAs

    if (!action || !view) {
      return next.handle()
    }

    return from(
      this.audit.record({
        actorId: view.adminId,
        actorRole: view.adminStatus,
        action: `view-as.${action}`,
        outcome: 'success',
        targetType: 'player',
        targetId: request.principal.user.id,
        reason: request.originalUrl,
        before: null,
        after: null,
        ip: request.ip ?? null,
        requestId: currentRequestId() ?? null
      })
    ).pipe(mergeMap(() => next.handle()))
  }
}
