import { Clock } from '../../shared/application/clock'
import { Principal } from './auth.service'

interface Entry {
  principal: Principal
  expiresAt: number
}

// Remembers who a token belongs to for a moment, so that a burst of requests (a client loading a game screen) checks the session,
// the user and the identity once instead of once per request. The price is that a ban or a revoked session takes effect up to
// `ttlMs` later; 0 switches the cache off. The oldest entry makes room when it is full.
export class PrincipalCache {
  private readonly entries = new Map<string, Entry>()

  constructor(
    private readonly clock: Clock,
    private readonly ttlMs: number,
    private readonly maxEntries = 5000
  ) {}

  get(token: string): Principal | undefined {
    const entry = this.entries.get(token)

    if (!entry) {
      return undefined
    }
    if (entry.expiresAt <= this.clock.now().getTime()) {
      this.entries.delete(token)
      return undefined
    }
    return entry.principal
  }

  set(token: string, principal: Principal): void {
    if (this.ttlMs <= 0) {
      return
    }
    if (this.entries.size >= this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value as string)
    }
    this.entries.set(token, { principal, expiresAt: this.clock.now().getTime() + this.ttlMs })
  }
}
