export const API_ACTIVITY = Symbol('ApiActivity')

// A player who comes back within this time of leaving is reconnecting, not arriving
const RECONNECT_WINDOW_MS = 60_000

export interface ApiActivitySnapshot {
  // Sockets open now, and the players who have at least one open
  socketsOpen: number
  onlinePlayers: number
  // Since the process started
  socketConnects: number
  socketReconnects: number
  rateLimitHits: number
}

// What the API tier knows of its own traffic that the console shows (design §25.5): the sockets open on this node, the players on
// them, and the requests the rate limit refused. A holder of counters, written by the socket adapter and the rate limiter, read by the
// sampler.
export class ApiActivity {
  private readonly openByPlayer = new Map<string, number>()
  private readonly leftAt = new Map<string, number>()
  private socketsOpen = 0
  private socketConnects = 0
  private socketReconnects = 0
  private rateLimitHits = 0

  rateLimitHit(): void {
    this.rateLimitHits += 1
  }

  // A socket was opened; `userId` is absent for one that is not a player's
  socketOpened(userId: string | undefined, atMs: number): void {
    this.socketsOpen += 1
    this.socketConnects += 1
    if (userId === undefined) {
      return
    }
    const wasAway = this.leftAt.get(userId)
    if (wasAway !== undefined && atMs - wasAway <= RECONNECT_WINDOW_MS) {
      this.socketReconnects += 1
    }
    this.leftAt.delete(userId)
    this.openByPlayer.set(userId, (this.openByPlayer.get(userId) ?? 0) + 1)
  }

  socketClosed(userId: string | undefined, atMs: number): void {
    this.socketsOpen = Math.max(0, this.socketsOpen - 1)
    if (userId === undefined) {
      return
    }
    const remaining = (this.openByPlayer.get(userId) ?? 1) - 1
    if (remaining > 0) {
      this.openByPlayer.set(userId, remaining)
      return
    }
    this.openByPlayer.delete(userId)
    this.leftAt.set(userId, atMs)
    this.forgetOld(atMs)
  }

  snapshot(): ApiActivitySnapshot {
    return {
      socketsOpen: this.socketsOpen,
      onlinePlayers: this.openByPlayer.size,
      socketConnects: this.socketConnects,
      socketReconnects: this.socketReconnects,
      rateLimitHits: this.rateLimitHits
    }
  }

  // Players who left long ago are not remembered, so that the map stays as small as the traffic
  private forgetOld(atMs: number): void {
    for (const [userId, at] of this.leftAt) {
      if (atMs - at > RECONNECT_WINDOW_MS) {
        this.leftAt.delete(userId)
      }
    }
  }
}
