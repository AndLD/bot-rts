const KEEP_PER_KEY = 1000

// How often each API key was held back by its rate limit, for the security page of the console. It lives in the memory of the
// node: with several API nodes each counts its own.
export class RateLimitHits {
  private readonly hits = new Map<string, number[]>()

  record(keyId: string, atMs: number): void {
    const times = this.hits.get(keyId) ?? []
    times.push(atMs)
    this.hits.set(keyId, times.length > KEEP_PER_KEY ? times.slice(-KEEP_PER_KEY) : times)
  }

  // The hits of every key since the moment, and the times older than it are forgotten
  since(sinceMs: number): Map<string, number> {
    const counts = new Map<string, number>()

    for (const [keyId, times] of this.hits) {
      const recent = times.filter((time) => time >= sinceMs)
      if (recent.length) {
        this.hits.set(keyId, recent)
        counts.set(keyId, recent.length)
      } else {
        this.hits.delete(keyId)
      }
    }

    return counts
  }
}
