import { loadConfig } from '../config/app-config'
import { FakeClock } from '../../tests/fakes/fakes'
import { GatewayMetricSource } from './infrastructure/gateway-metric.source'
import { metricSourcesFor } from './monitoring.module'

const base = { DATABASE_URL: 'postgresql://botrts:botrts@localhost:5432/botrts' }

function sourcesOf(env: Record<string, string>) {
  return metricSourcesFor(
    loadConfig({ ...base, ...env }),
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    new FakeClock()
  )
}

describe('metricSourcesFor', () => {
  it('reads the activity, the database, the jobs and the host of the node', () => {
    const sources = sourcesOf({})

    expect(sources).toHaveLength(4)
    expect(sources.some((source) => source instanceof GatewayMetricSource)).toBe(false)
  })

  it('also reads the gateway when its address is configured, and the backup status file', () => {
    const sources = sourcesOf({ OTEL_GATEWAY_HEALTH_URL: 'http://g/health', BACKUP_STATUS_FILE: '/tmp/backup.json' })

    expect(sources).toHaveLength(5)
    expect(sources[0]).toBeInstanceOf(GatewayMetricSource)
  })
})
