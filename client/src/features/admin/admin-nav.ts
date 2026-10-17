import type { AdminPermission } from '@lib/utils/admin'

export interface AdminNavItem {
  path: string
  // The key under `admin.nav`
  labelKey: string
  // Who sees the entry; an entry without one is for every admin
  permission?: AdminPermission
}

// The pages of the console, in the order of the menu. A page is added here when it exists.
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { path: '/admin', labelKey: 'dashboard', permission: 'dashboard.read' },
  { path: '/admin/players', labelKey: 'players', permission: 'players.read' },
  { path: '/admin/inspector', labelKey: 'inspector', permission: 'inspector.read' },
  { path: '/admin/map', labelKey: 'map', permission: 'map.read' },
  { path: '/admin/supervision', labelKey: 'supervision', permission: 'supervision.read' },
  { path: '/admin/security', labelKey: 'security', permission: 'security.read' },
  { path: '/admin/economy', labelKey: 'economy', permission: 'economy.read' },
  { path: '/admin/analytics', labelKey: 'analytics', permission: 'analytics.read' },
  { path: '/admin/operations', labelKey: 'operations', permission: 'dashboard.read' },
  { path: '/admin/game-time', labelKey: 'gameTime', permission: 'dashboard.read' },
  { path: '/admin/devtools', labelKey: 'devtools', permission: 'devtools.use' },
  { path: '/admin/logs', labelKey: 'logs', permission: 'audit.read' },
  { path: '/admin/api-keys', labelKey: 'apiKeys', permission: 'apikeys.admin' },
  { path: '/admin/docs', labelKey: 'docs' }
]
