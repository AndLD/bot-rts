// Headers the web client's pages are served with (next.config.ts). The pages are the player's own game: nothing may frame them, the
// browser must not guess content types, a link to another site does not tell it the address of the page, and the powerful features
// the game does not use are switched off. No CSP is set here yet: the game page needs inline styles of Ant Design and the sockets to
// the API host, which a policy has to list; that is a separate piece of work.
export const SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=15552000; includeSubDomains' }
]
