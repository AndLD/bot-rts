import { Logger } from '../../shared/application/logger'
import { LogStoreUnavailableError } from '../domain/log-store.errors'

export interface ElasticsearchSettings {
  url: string
  // A read-only account: an API key, or a user and a password
  apiKey?: string
  username?: string
  password?: string
  timeoutMs: number
}

export type Fetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

// The way the console asks Elasticsearch: a read-only account, a time limit, and a plain `LogStoreUnavailableError` for anything that
// goes wrong, so that the stores of logs and traces say it the same way
export class ElasticsearchClient {
  constructor(
    private readonly settings: ElasticsearchSettings,
    private readonly logger: Logger,
    private readonly fetchImpl: Fetch = fetch
  ) {}

  // Searches `index`; the answer, or null when there is no such data stream yet (nothing was ever written to it)
  async search<T>(index: string, body: object): Promise<T | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.settings.timeoutMs)
    try {
      const response = await this.fetchImpl(`${this.settings.url.replace(/\/+$/, '')}/${index}/_search`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: controller.signal
      })
      if (response.status === 404) {
        return null
      }
      if (!response.ok) {
        this.logger.warn(`The log store answered ${response.status}`)
        throw new LogStoreUnavailableError(`The log store refused the search (${response.status})`)
      }

      return (await response.json()) as T
    } catch (error) {
      if (error instanceof LogStoreUnavailableError) {
        throw error
      }
      const timedOut = controller.signal.aborted
      this.logger.warn(`The log store did not answer: ${(error as Error).message}`)
      throw new LogStoreUnavailableError(
        timedOut ? 'The log store did not answer in time' : 'The log store cannot be reached'
      )
    } finally {
      clearTimeout(timer)
    }
  }

  private headers(): Record<string, string> {
    const { apiKey, username, password } = this.settings
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (apiKey) {
      headers.authorization = `ApiKey ${apiKey}`
    } else if (username !== undefined) {
      headers.authorization = `Basic ${Buffer.from(`${username}:${password ?? ''}`).toString('base64')}`
    }

    return headers
  }
}
