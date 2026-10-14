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
  { path: '/admin', labelKey: 'dashboard', permission: 'dashboard.read' }
]
