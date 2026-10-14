import { AuthenticatedRequest } from '../../auth/presentation/auth.guard'

// What a handler tells the audit interceptor about the change it made
export interface AuditDetail {
  targetType?: string
  targetId?: string
  reason?: string
  before?: unknown
  after?: unknown
}

export interface AdminRequest extends AuthenticatedRequest {
  auditDetail?: AuditDetail
}
