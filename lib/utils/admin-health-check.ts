import type { HealthStatus, IAlert } from './admin'

// One summary of the state of the system for a quick look, or for an AI assistant (design §25.5; `GET /api/v1/admin/health-check`).
// A figure is null when it has not been sampled yet.
export interface IHealthCheck {
  // Milliseconds since the epoch; null before the first sample
  sampledAt: number | null
  status: HealthStatus
  // The alerts that are open now
  alerts: IAlert[]
  tick: {
    p95Ms: number | null
    // The 95th percentile tick as a share of the tick interval
    p95Ratio: number | null
    // Ticks over the interval, as a share of the ticks since the previous sample
    overrunRate: number | null
    cutTicks: number | null
    skippedTicks: number | null
  }
  scripts: {
    // Scripts stopped for using more than the slice of a tick
    killedBySlice: number | null
  }
  flush: {
    lastMs: number | null
    lagMs: number | null
    pending: number | null
  }
  store: {
    // The status of the database figures (size, connections, query time)
    databaseStatus: HealthStatus
    // Whether the log gateway answered the last probe; null when no gateway is configured
    isLogGatewayUp: boolean | null
  }
}
