import type { CurrentUser } from '../features/auth/hooks'

// Which pages a visitor may open depends on who they are; every other address leads to `redirect`
export interface Access {
  allowed: readonly string[]
  redirect: string
}

// Pages that act on the token of an emailed link, for whoever opens it
const LINK_PAGES = ['/verification', '/confirm-email-change', '/confirm-account-deletion'] as const

const ACCESS: Record<Exclude<CurrentUser['state'], 'loading'>, Access> = {
  anonymous: { allowed: ['/auth', '/forgot-password', '/reset-password', ...LINK_PAGES], redirect: '/auth' },
  // Signed in, but the email is not confirmed yet
  unverified: { allowed: ['/forbidden', ...LINK_PAGES], redirect: '/forbidden' },
  blocked: { allowed: ['/blocked', ...LINK_PAGES], redirect: '/blocked' },
  active: { allowed: ['/game', '/account', ...LINK_PAGES], redirect: '/game' }
}

// The admin console decides for itself who may see it: it asks the server (an admin role and the second factor)
const ADMIN_AREA = '/admin'

function isAdminArea(pathname: string): boolean {
  return pathname === ADMIN_AREA || pathname.startsWith(`${ADMIN_AREA}/`)
}

// The address to send the visitor to, or null when they may stay (or while who they are is still being loaded)
export function resolveRedirect(state: CurrentUser['state'], pathname: string): string | null {
  if (state === 'loading') {
    return null
  }

  const { allowed, redirect } = ACCESS[state]

  return allowed.includes(pathname) || (state === 'active' && isAdminArea(pathname)) ? null : redirect
}
