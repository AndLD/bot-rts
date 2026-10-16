import { LogRetention } from '../../retention/application/retention-settings.service'
import { ElasticsearchClient } from './elasticsearch-client'

// The lifecycle policy of the log and trace data streams (the same shape as deploy/observability/elasticsearch/ilm-policy.json, which
// the compose setup creates): roll over daily, delete after the retention
export const RETENTION_POLICY_NAME = 'botrts-retention'

// Applies the retention of the logs and traces that an admin sets in the console to the lifecycle policy of the log store, with an
// account that may change that policy (and nothing else is asked of it)
export class ElasticsearchLogRetention implements LogRetention {
  constructor(private readonly client: ElasticsearchClient) {}

  async apply(days: number): Promise<void> {
    await this.client.put(`_ilm/policy/${RETENTION_POLICY_NAME}`, {
      policy: {
        phases: {
          hot: { actions: { rollover: { max_age: '1d', max_primary_shard_size: '5gb' } } },
          delete: { min_age: `${days}d`, actions: { delete: {} } }
        }
      }
    })
  }
}
