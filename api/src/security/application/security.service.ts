import {
  IScriptConsumer,
  ISecurityApiKey,
  ISecurityOverview,
  SECURITY_THRESHOLDS
} from '../../../../lib/utils/admin-security'
import { ApiKeyService } from '../../apikeys/application/api-key.service'
import { RateLimitHits } from '../../apikeys/application/rate-limit-hits'
import { EnginePort } from '../../engine/application/engine-port'
import { Clock } from '../../shared/application/clock'
import { SecurityReadModel } from './ports'

const HOUR_MS = 3_600_000
const LIST_SIZE = 20
const KEYS_SHOWN = 50
const TOP_CONSUMERS = 10
// The failure codes of the sandbox protecting the server (design §13): the wall-clock slice, the heap, and the sandbox itself
const SANDBOX_CODES = ['TIME_LIMIT', 'MEMORY_LIMIT', 'SANDBOX_FAULT'] as const

// The Security page (design §25.3): where abuse shows first. Everything is read; the actions are the ones of the other pages
// (ban, quarantine) and the revoking of a key.
export class SecurityService {
  constructor(
    private readonly readModel: SecurityReadModel,
    private readonly hits: RateLimitHits,
    private readonly keys: ApiKeyService,
    private readonly engine: EnginePort,
    private readonly clock: Clock
  ) {}

  async overview(hours: number): Promise<ISecurityOverview> {
    const now = this.clock.now()
    const since = new Date(now.getTime() - hours * HOUR_MS)
    const hitsByKey = this.hits.since(since.getTime())
    const [byIp, byEmail, sameIp, multiIp, lockouts, keys, scripts, consumers] = await Promise.all([
      this.readModel.failedLoginsByIp(since, LIST_SIZE),
      this.readModel.failedLoginsByEmail(since, LIST_SIZE),
      this.readModel.sameIpAccounts(since, SECURITY_THRESHOLDS.accountsPerIp, LIST_SIZE),
      this.readModel.multiIpAccounts(since, SECURITY_THRESHOLDS.ipsPerAccount, LIST_SIZE),
      this.readModel.botLockouts(now, LIST_SIZE),
      this.readModel.apiKeys(KEYS_SHOWN),
      this.readModel.failedScripts(since, SANDBOX_CODES, LIST_SIZE),
      this.topConsumers()
    ])

    return {
      hours,
      failedLoginsByIp: byIp,
      failedLoginsByEmail: byEmail,
      sameIpAccounts: sameIp,
      multiIpAccounts: multiIp,
      botLockouts: lockouts,
      apiKeys: keys.map((key): ISecurityApiKey => ({
        _id: key.id,
        name: key.name,
        prefix: key.prefix,
        owner: { _id: key.owner.id, name: key.owner.name },
        scopes: key.scopes,
        ratePerMinute: key.ratePerMinute,
        createdAt: key.createdAt.getTime(),
        lastUsedAt: key.lastUsedAt?.getTime() ?? null,
        expiresAt: key.expiresAt?.getTime() ?? null,
        isRevoked: key.revokedAt !== null,
        rateLimitHits: hitsByKey.get(key.id) ?? 0
      })),
      suspiciousScripts: scripts.map((script) => ({ ...script, code: script.reason.split(':')[0] })),
      topConsumers: consumers
    }
  }

  async revokeKey(id: string): Promise<{ before: unknown; after: unknown }> {
    const key = await this.keys.revokeAsAdmin(id)

    return { before: { owner: key.userId, scopes: key.scopes }, after: { revoked: true } }
  }

  // The engine may be down or switched off; the rest of the page is still worth showing
  private async topConsumers(): Promise<IScriptConsumer[] | null> {
    try {
      return (await this.engine.top(TOP_CONSUMERS)).map(({ id, ...usage }) => ({ executionId: id, ...usage }))
    } catch {
      return null
    }
  }
}
