import type { CurrentUser } from '../features/auth/hooks'

// Which pages a visitor may open depends on who they are; every other address leads to `redirect`
export interface Access {
  allowed: readonly string[]
  redirect: string
}

const ACCESS: Record<Exclude<CurrentUser['state'], 'loading'>, Access> = {
  anonymous: { allowed: ['/auth', '/verification'], redirect: '/auth' },
  // Signed in, but the email is not confirmed yet
  unverified: { allowed: ['/forbidden', '/verification'], redirect: '/forbidden' },
  blocked: { allowed: ['/blocked'], redirect: '/blocked' },
  active: { allowed: ['/game'], redirect: '/game' }
}

// The address to send the visitor to, or null when they may stay (or while who they are is still being loaded)
export function resolveRedirect(state: CurrentUser['state'], pathname: string): string | null {
  if (state === 'loading') {
    return null
  }

  const { allowed, redirect } = ACCESS[state]

  return allowed.includes(pathname) ? null : redirect
}
