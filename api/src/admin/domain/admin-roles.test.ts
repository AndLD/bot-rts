import {
  ADMIN_PERMISSIONS,
  ADMIN_ROLES,
  hasPermission,
  isAdminRole,
  permissionsOf,
  ROLE_PERMISSIONS
} from '../../../../lib/utils/admin'

describe('admin roles', () => {
  it('knows which statuses are admin roles', () => {
    for (const role of ADMIN_ROLES) {
      expect(isAdminRole(role)).toBe(true)
    }
    for (const status of ['user', 'unlimited', 'banned'] as const) {
      expect(isAdminRole(status)).toBe(false)
      expect(permissionsOf(status)).toEqual([])
    }
  })

  it('gives owners everything and admins everything except the owner-only actions', () => {
    expect(ROLE_PERMISSIONS.owner).toEqual(ADMIN_PERMISSIONS)
    expect(hasPermission('admin', 'players.ban')).toBe(true)
    for (const permission of ['players.change-role', 'players.delete', 'ops.kill-switch', 'devtools.use'] as const) {
      expect(hasPermission('admin', permission)).toBe(false)
      expect(hasPermission('owner', permission)).toBe(true)
    }
  })

  it('keeps moderators to moderation and read-only inspection, and analysts to read-only reports', () => {
    expect(hasPermission('moderator', 'players.ban')).toBe(true)
    expect(hasPermission('moderator', 'inspector.read')).toBe(true)
    expect(hasPermission('moderator', 'inspector.files.read')).toBe(false)
    expect(hasPermission('moderator', 'balance.write')).toBe(false)
    expect(hasPermission('moderator', 'ops.pause-world')).toBe(false)
    expect(permissionsOf('analyst')).toEqual(['dashboard.read', 'analytics.read', 'economy.read'])
  })

  it('gives every permission to at least one role', () => {
    for (const permission of ADMIN_PERMISSIONS) {
      expect(ADMIN_ROLES.some((role) => hasPermission(role, permission))).toBe(true)
    }
  })
})
