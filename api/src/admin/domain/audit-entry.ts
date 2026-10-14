export const AUDIT_OUTCOMES = ['success', 'denied', 'failed'] as const

export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number]

// One line of the append-only trail of admin actions (design §25.2): who did what to whom, when, why, and what changed
export interface AuditEntry {
  readonly id: string
  readonly at: Date
  readonly actorId: string
  readonly actorRole: string
  // Dotted name such as `players.ban`, or `METHOD /path` for a call nobody named
  readonly action: string
  readonly outcome: AuditOutcome
  readonly targetType: string | null
  readonly targetId: string | null
  readonly reason: string | null
  readonly before: unknown
  readonly after: unknown
  readonly ip: string | null
  readonly requestId: string | null
}

export interface AuditFilter {
  actorId?: string
  action?: string
  targetId?: string
  outcome?: AuditOutcome
  from?: Date
  to?: Date
}
