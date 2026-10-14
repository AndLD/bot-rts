import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { AdminRequest, AuditDetail } from './admin-request'

// The mutable record a handler fills with the target, reason and before/after values of its change
export const AuditDetailParam = createParamDecorator((_: unknown, context: ExecutionContext): AuditDetail => {
  const request = context.switchToHttp().getRequest<AdminRequest>()
  request.auditDetail ??= {}

  return request.auditDetail
})
