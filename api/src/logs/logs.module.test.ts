import { testTelemetry } from '../../tests/fakes/telemetry'
import { FakeClock } from '../../tests/fakes/fakes'
import { AppConfig, loadConfig } from '../config/app-config'
import { LogBuffer } from '../shared/application/log-buffer'
import { createLogStore } from './logs.module'

const base = { DATABASE_URL: 'postgresql://botrts:botrts@localhost:5432/botrts' }
const logger = testTelemetry().telemetry.logger('test')
const build = (config: AppConfig) => createLogStore(config, new LogBuffer(5), new FakeClock(), logger)

describe('createLogStore', () => {
  it('reads the recent lines of this process by default, as the API or as the engine node', async () => {
    const api = build(loadConfig(base))
    const engine = build(loadConfig({ ...base, APP_ROLE: 'engine', REDIS_URL: 'redis://localhost:6379' }))

    expect(api.name).toBe('memory')
    expect((await api.nodes())[0].services).toEqual(['botrts-api'])
    expect((await engine.nodes())[0].services).toEqual(['botrts-engine'])
  })

  it('reads Elasticsearch when asked to', () => {
    const store = build(loadConfig({ ...base, LOG_STORE: 'elasticsearch', ELASTICSEARCH_URL: 'http://localhost:9200' }))

    expect(store.name).toBe('elasticsearch')
  })
})
