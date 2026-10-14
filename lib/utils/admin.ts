import type { UserStatus } from './interfaces/users'

// What an admin may do (design §25.2). Roles are sets of these permissions, checked on the server for every request.
export const ADMIN_PERMISSIONS = [
  'dashboard.read',
  'alerts.acknowledge',
  'players.read',
  'players.ban',
  'players.logout',
  'players.resend-verification',
  'players.reset-password',
  'players.notes',
  'players.change-role',
  'players.delete',
  'inspector.read',
  'inspector.files.read',
  'inspector.kill-execution',
  'inspector.reboot-bot',
  'map.read',
  'supervision.read',
  'supervision.quarantine',
  'supervision.support',
  'ops.pause-world',
  'ops.kill-switch',
  'ops.announce',
  'ops.restart-runtime',
  'security.read',
  'security.revoke-key',
  'economy.read',
  'balance.write',
  'logs.read',
  'audit.read',
  'audit.export',
  'analytics.read',
  'devtools.use'
] as const

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number]

export const ADMIN_ROLES = ['owner', 'admin', 'moderator', 'analyst'] as const

export type AdminRole = (typeof ADMIN_ROLES)[number]

// Only owners hold these: role changes and the irreversible or world-wide actions
const OWNER_ONLY: readonly AdminPermission[] = [
  'players.change-role',
  'players.delete',
  'ops.kill-switch',
  'ops.restart-runtime',
  'supervision.support',
  'devtools.use'
]

const MODERATOR: readonly AdminPermission[] = [
  'dashboard.read',
  'players.read',
  'players.ban',
  'players.logout',
  'players.resend-verification',
  'players.reset-password',
  'players.notes',
  'inspector.read',
  'map.read',
  'supervision.read',
  'security.read'
]

const ANALYST: readonly AdminPermission[] = ['dashboard.read', 'analytics.read', 'economy.read']

export const ROLE_PERMISSIONS: Readonly<Record<AdminRole, readonly AdminPermission[]>> = {
  owner: ADMIN_PERMISSIONS,
  admin: ADMIN_PERMISSIONS.filter((permission) => !OWNER_ONLY.includes(permission)),
  moderator: MODERATOR,
  analyst: ANALYST
}

export function isAdminRole(status: UserStatus): status is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(status)
}

export function permissionsOf(status: UserStatus): readonly AdminPermission[] {
  return isAdminRole(status) ? ROLE_PERMISSIONS[status] : []
}

export function hasPermission(status: UserStatus, permission: AdminPermission): boolean {
  return permissionsOf(status).includes(permission)
}

// What the console shows about the signed-in admin and the second factor (GET /api/v1/admin/me)
export interface IAdminMe {
  role: AdminRole
  permissions: AdminPermission[]
  twoFactor: { isEnrolled: boolean; isVerified: boolean }
}

export interface ITwoFactorEnrollment {
  // The base32 secret, for typing into an authenticator app by hand
  secret: string
  // The otpauth:// address, drawn as a QR code by the client
  otpauthUrl: string
}

// Shown once, when the second factor is switched on
export interface ITwoFactorRecoveryCodes {
  recoveryCodes: string[]
}

export interface IAuditEntry {
  _id: string
  // Milliseconds since the epoch
  at: number
  actorId: string
  actorRole: string
  action: string
  outcome: 'success' | 'denied' | 'failed'
  targetType: string | null
  targetId: string | null
  reason: string | null
  before: unknown
  after: unknown
  ip: string | null
  requestId: string | null
}

export interface IAuditPage {
  result: IAuditEntry[]
  meta: { pagination: { page: number; results: number; total: number } }
}
