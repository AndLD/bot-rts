// The origins a browser may call the API from (CORS, Socket.IO, the cookie routes). An entry is an exact origin
// (`https://play.example`) or has one wildcard in the leftmost label of the host, for preview deployments:
// `https://bot-rts-*.vercel.app`, `https://*.preview.example.com`.

const ORIGIN = /^(https?):\/\/([a-z0-9-]*\*?[a-z0-9-]*)((?:\.[a-z0-9-]+)+)(:\d+)?$/i
const EXACT = /^https?:\/\/[^/*]+$/

// What is wrong with the entries, for the configuration to report. A wildcard must not be able to match a whole public suffix
// such as every project of a hosting service, so `https://*.vercel.app` is refused while `https://bot-rts-*.vercel.app` and
// `https://*.preview.example.com` are not.
export function invalidOrigins(entries: readonly string[]): string[] {
  return entries.flatMap((entry) => {
    if (!entry.includes('*')) {
      return EXACT.test(entry) ? [] : [`${entry} is not an origin like https://play.example`]
    }
    const match = ORIGIN.exec(entry)
    if (!match) {
      return [`${entry}: a wildcard may only stand in the first label of the host, like https://app-*.example.com`]
    }
    const [, , label, rest] = match
    const hasPrefix = label.replace('*', '').length > 0
    const restLabels = rest.split('.').length - 1

    return hasPrefix || restLabels >= 3
      ? []
      : [`${entry}: a bare *. wildcard would match too many sites, add a prefix or a longer domain`]
  })
}

const escape = (text: string) => text.replace(/[.+?^${}()|[\]\\]/g, '\\$&')

// A function that says whether an origin may call. A request without an Origin header is not a browser and passes.
export function originMatcher(entries: readonly string[]): (origin: string | undefined) => boolean {
  const exact = new Set(entries.filter((entry) => !entry.includes('*')))
  const patterns = entries
    .filter((entry) => entry.includes('*'))
    .map((entry) => new RegExp(`^${escape(entry).replace('*', '[a-z0-9-]*')}$`, 'i'))

  return (origin) => !origin || exact.has(origin) || patterns.some((pattern) => pattern.test(origin))
}
