import { HealthStatus } from '../../../../lib/utils/admin'
import { IHealthCheck } from '../../../../lib/utils/admin-health-check'
import { HealthView } from './monitoring.service'
import { toAlertDto } from './alert-dto'

// Composes the summary of `GET /admin/health-check` from the last sample and the open alerts
export function composeHealthCheck(view: HealthView): IHealthCheck {
  const metrics = view.areas.flatMap((area) => area.metrics)
  const value = (id: string): number | null => metrics.find((metric) => metric.id === id)?.value ?? null
  const gateway = value('infrastructure.gatewayUp')
  const database: HealthStatus = view.areas.find((area) => area.area === 'database')?.status ?? 'green'

  return {
    sampledAt: view.sampledAt?.getTime() ?? null,
    status: view.status,
    alerts: view.alerts.map(toAlertDto),
    tick: {
      p95Ms: value('engine.tickP95Ms'),
      p95Ratio: value('engine.tickP95Ratio'),
      overrunRate: value('engine.overrunRate'),
      cutTicks: value('engine.cutTicks'),
      skippedTicks: value('engine.ticksSkipped')
    },
    scripts: { killedBySlice: value('scripts.killedBySlice') },
    flush: {
      lastMs: value('engine.flushMs'),
      lagMs: value('engine.flushLagMs'),
      pending: value('engine.flushPending')
    },
    store: { databaseStatus: database, isLogGatewayUp: gateway === null ? null : gateway >= 1 }
  }
}
