export const QUERY_STATS = Symbol('QueryStats')

// Upper bounds of the query duration histogram in ms (the console's `db.queryMs`, see monitoring/domain/histograms.ts)
export const QUERY_BOUNDS_MS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500]

// Statements are kept without their parameters (Prisma hands them over as `$1`, `$2`), cut to this length
const MAX_STATEMENT_CHARS = 500

export interface SlowQuery {
  at: Date
  durationMs: number
  statement: string
}

export interface QueryStatsSnapshot {
  // Queries since the process started, and per duration bucket (one count per bound, one above the last)
  count: number
  buckets: number[]
  slowCount: number
}

// How long the queries of this process take (design §25.5, Database): the distribution, how many were slow, and the last few slow ones.
// Told by the database client for every query it runs.
export class QueryStats {
  private count = 0
  private slowCount = 0
  private readonly buckets = QUERY_BOUNDS_MS.map(() => 0).concat(0)
  private slow: SlowQuery[] = []

  constructor(
    // A query that takes at least this long is slow
    private readonly slowMs: number,
    private readonly now: () => Date,
    private readonly keep = 20
  ) {}

  observe(durationMs: number, statement: string): void {
    const index = QUERY_BOUNDS_MS.findIndex((bound) => durationMs <= bound)

    this.count += 1
    this.buckets[index === -1 ? QUERY_BOUNDS_MS.length : index] += 1
    if (durationMs >= this.slowMs) {
      this.slowCount += 1
      this.slow = [
        { at: this.now(), durationMs, statement: statement.slice(0, MAX_STATEMENT_CHARS) },
        ...this.slow
      ].slice(0, this.keep)
    }
  }

  snapshot(): QueryStatsSnapshot {
    return { count: this.count, buckets: [...this.buckets], slowCount: this.slowCount }
  }

  // The newest first
  slowQueries(): SlowQuery[] {
    return this.slow.map((query) => ({ ...query }))
  }
}
