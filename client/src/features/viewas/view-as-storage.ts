// "View as player" (design §25.2) lives in one browser tab: its token and its details are kept in sessionStorage, so the admin's
// own session in the other tabs (localStorage and the refresh cookie) is never touched.

const VIEW_KEY = 'viewAs'
const HANDOFF_KEY = 'viewAsHandoff'
const HANDOFF_PARAM = 'view-as'
// A started view waits this long for the new tab to take it over
const HANDOFF_MAX_AGE_MS = 60_000

export interface ViewAsInfo {
  token: string
  // Milliseconds since the epoch
  expiresAt: number
  playerName: string
}

interface Handoff {
  info: ViewAsInfo
  at: number
}

function parse(raw: string | null): unknown {
  try {
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function isInfo(value: unknown): value is ViewAsInfo {
  const info = value as Partial<ViewAsInfo> | null

  return typeof info?.token === 'string' && typeof info.expiresAt === 'number' && typeof info.playerName === 'string'
}

function readHandoff(): ViewAsInfo | null {
  try {
    const handoff = parse(localStorage.getItem(HANDOFF_KEY)) as Handoff | null
    localStorage.removeItem(HANDOFF_KEY)

    return handoff && isInfo(handoff.info) && Date.now() - handoff.at < HANDOFF_MAX_AGE_MS ? handoff.info : null
  } catch {
    return null
  }
}

// The view this tab shows, or null in an ordinary tab. A tab opened by `openViewAsTab` takes the started view over on its first read.
export function readViewAs(): ViewAsInfo | null {
  try {
    const stored = parse(sessionStorage.getItem(VIEW_KEY))

    if (isInfo(stored)) {
      return stored
    }
    if (!new URLSearchParams(window.location.search).has(HANDOFF_PARAM)) {
      return null
    }
    const adopted = readHandoff()

    if (adopted) {
      sessionStorage.setItem(VIEW_KEY, JSON.stringify(adopted))
    }

    return adopted
  } catch {
    return null
  }
}

export function clearViewAs(): void {
  try {
    sessionStorage.removeItem(VIEW_KEY)
  } catch {
    // Nothing is kept then
  }
}

// Opens the game as the player in a new tab. The token goes through localStorage for a moment: a URL would put it in the history.
export function openViewAsTab(info: ViewAsInfo): boolean {
  try {
    localStorage.setItem(HANDOFF_KEY, JSON.stringify({ info, at: Date.now() } satisfies Handoff))
  } catch {
    return false
  }

  return window.open(`/game?${HANDOFF_PARAM}=1`, '_blank') !== null
}
