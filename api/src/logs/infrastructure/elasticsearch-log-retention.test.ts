import { fakeElasticsearch } from '../../../tests/fakes/elasticsearch'
import { createLogRetention } from '../../retention/retention.module'
import { loadConfig } from '../../config/app-config'
import { NO_LOG_RETENTION } from '../../retention/application/retention-settings.service'
import { ElasticsearchLogRetention, RETENTION_POLICY_NAME } from './elasticsearch-log-retention'

describe('ElasticsearchLogRetention', () => {
  it('writes the lifecycle policy: roll over daily, delete after the days asked for', async () => {
    const { client, calls } = fakeElasticsearch()

    await new ElasticsearchLogRetention(client).apply(21)

    expect(calls[0]).toMatchObject({
      method: 'PUT',
      url: `https://es.example:9200/_ilm/policy/${RETENTION_POLICY_NAME}`
    })
    expect(calls[0].body.policy.phases).toEqual({
      hot: { actions: { rollover: { max_age: '1d', max_primary_shard_size: '5gb' } } },
      delete: { min_age: '21d', actions: { delete: {} } }
    })
  })

  it('is the same policy that the compose setup creates', () => {
    expect(RETENTION_POLICY_NAME).toBe('botrts-retention')
  })
})

describe('createLogRetention', () => {
  const base = { DATABASE_URL: 'postgresql://botrts:botrts@localhost:5432/botrts' }
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const elasticsearch = { ...base, LOG_STORE: 'elasticsearch', ELASTICSEARCH_URL: 'http://localhost:9200' }

  it('applies nothing without the log store, or without an account that may change the policy', () => {
    expect(createLogRetention(loadConfig(base), logger)).toBe(NO_LOG_RETENTION)
    expect(createLogRetention(loadConfig(elasticsearch), logger)).toBe(NO_LOG_RETENTION)
    expect(createLogRetention(loadConfig({ ...base, ELASTICSEARCH_ADMIN_API_KEY: 'k' }), logger)).toBe(NO_LOG_RETENTION)
  })

  it('writes to the log store with that account when there is one', () => {
    const byKey = createLogRetention(loadConfig({ ...elasticsearch, ELASTICSEARCH_ADMIN_API_KEY: 'k' }), logger)
    const byUser = createLogRetention(
      loadConfig({ ...elasticsearch, ELASTICSEARCH_ADMIN_USERNAME: 'admin', ELASTICSEARCH_ADMIN_PASSWORD: 'p' }),
      logger
    )

    expect(byKey).toBeInstanceOf(ElasticsearchLogRetention)
    expect(byUser).toBeInstanceOf(ElasticsearchLogRetention)
  })
})
