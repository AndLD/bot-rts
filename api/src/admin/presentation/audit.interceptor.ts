import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { catchError, concatMap, from, Observable, throwError } from 'rxjs'
import { currentRequestId } from '../../shared/application/request-context'
import { AuditService } from '../application/audit.service'
import { AuditOutcome } from '../domain/audit-entry'
import { AdminRequest } from './admin-request'
import { ADMIN_ONLY_KEY, ADMIN_PERMISSION_KEY, AUDIT_KEY, AuditOptions } from './admin-permission.decorator'

const READ_METHODS = ['GET', 'HEAD', 'OPTIONS']

// Writes the audit entry of an admin call after it ran: every call that changes something, and every read that asks for it with
// @Audited(). The handler adds the target, reason and before/after values through `AuditDetailParam`. The entry is written
// before the response leaves, so an admin call never succeeds without a trail.
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const targets = [context.getHandler(), context.getClass()]
    const isAdminCall =
      this.reflector.getAllAndOverride<unknown>(ADMIN_PERMISSION_KEY, targets) ||
      this.reflector.getAllAndOverride<unknown>(ADMIN_ONLY_KEY, targets)
    const options = this.reflector.getAllAndOverride<AuditOptions | undefined>(AUDIT_KEY, targets)
    const request = context.switchToHttp().getRequest<AdminRequest>()

    if (!isAdminCall || (READ_METHODS.includes(request.method) && !options)) {
      return next.handle()
    }

    return next.handle().pipe(
      concatMap((value) => from(this.write(request, options, 'success').then(() => value))),
      catchError((error) => from(this.write(request, options, 'failed')).pipe(concatMap(() => throwError(() => error))))
    )
  }

  private write(request: AdminRequest, options: AuditOptions | undefined, outcome: AuditOutcome) {
    const { user } = request.principal
    const detail = request.auditDetail ?? {}
    const fromParam = options?.targetParam ? (request.params[options.targetParam] as string | undefined) : undefined

    return this.audit.record({
      actorId: user.id,
      actorRole: user.status,
      action: options?.action ?? `${request.method} ${request.route.path as string}`,
      outcome,
      targetType: detail.targetType ?? options?.targetType ?? null,
      targetId: detail.targetId ?? fromParam ?? null,
      reason: detail.reason ?? null,
      before: detail.before ?? null,
      after: detail.after ?? null,
      ip: request.ip ?? null,
      requestId: currentRequestId() ?? null
    })
  }
}
