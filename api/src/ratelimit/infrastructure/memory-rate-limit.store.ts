import { Clock } from '../../shared/application/clock'
import { RateLimitHit, RateLimitStore } from '../application/rate-limiter'

interface Window {
  hits: number
  endsAt: number
}

const SWEEP_ABOVE = 10_000

// Per-process counters: enough for one node and the fallback when Redis is down
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly windows = new Map<string, Window>()

  constructor(private readonly clock: Clock) {}

  async hit(key: string, windowMs: number): Promise<RateLimitHit> {
    const now = this.clock.now().getTime()
    const current = this.windows.get(key)
    const window = current && current.endsAt > now ? current : { hits: 0, endsAt: now + windowMs }

    window.hits += 1
    this.windows.set(key, window)
    this.sweep(now)

    return { hits: window.hits, resetInMs: window.endsAt - now }
  }

  private sweep(now: number): void {
    if (this.windows.size <= SWEEP_ABOVE) {
      return
    }
    for (const [key, window] of this.windows) {
      if (window.endsAt <= now) {
        this.windows.delete(key)
      }
    }
  }
}
