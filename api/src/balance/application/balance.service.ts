import { IBalanceDocument, IBalancePreview, IBalanceState } from '../../../../lib/utils/admin-balance'
import { Clock } from '../../shared/application/clock'
import { NotFoundError, ValidationError } from '../../shared/domain/errors'
import { applyBalance, BalanceConfig, diffBalance, flattenBalance, validateBalance } from '../domain/balance'
import { BalanceRepository, BalanceVersionRecord } from './ports'

export interface BalanceChange {
  before: unknown
  after: unknown
}

// The balance of the game as the console edits it (design §25.3): versions that are only added, a document checked before it is
// stored, and a diff against what is active. A new version applies when the server next starts: the running version is shown next to
// the active one.
export class BalanceService {
  constructor(
    private readonly versions: BalanceRepository,
    private readonly base: BalanceConfig,
    private readonly runningVersion: number | null,
    private readonly problem: string | null,
    private readonly clock: Clock
  ) {}

  async state(): Promise<IBalanceState> {
    const [list, activeVersion] = await Promise.all([this.versions.list(), this.versions.activeVersion()])
    const active = list.find((record) => record.version === activeVersion)
    const document = active?.document ?? {}

    return {
      activeVersion,
      runningVersion: this.runningVersion,
      problem: this.problem,
      documentJson: JSON.stringify(document, null, 2),
      effective: Object.entries(flattenBalance(applyBalance(this.base, document))).map(([path, value]) => ({
        path,
        value: String(value)
      })),
      versions: list.map((record) => ({
        version: record.version,
        reason: record.reason,
        createdBy: record.createdBy,
        createdAt: record.createdAt.getTime(),
        isActive: record.version === activeVersion
      }))
    }
  }

  async versionDocument(version: number): Promise<string> {
    return JSON.stringify((await this.require(version)).document, null, 2)
  }

  async preview(document: unknown): Promise<IBalancePreview> {
    const problems = validateBalance(this.base, document)

    return {
      problems,
      changes: problems.length
        ? []
        : diffBalance(await this.activeBalance(), applyBalance(this.base, document as IBalanceDocument))
    }
  }

  async save(actorId: string, document: IBalanceDocument, reason: string): Promise<BalanceChange> {
    const problems = validateBalance(this.base, document)

    if (problems.length) {
      throw new ValidationError(problems.join('; '))
    }
    const before = await this.activeBalance()
    const previous = await this.versions.activeVersion()
    const created = await this.versions.addAndActivate({
      document,
      reason,
      createdBy: actorId,
      createdAt: this.clock.now()
    })

    return {
      before: { version: previous },
      after: { version: created.version, changes: diffBalance(before, applyBalance(this.base, document)) }
    }
  }

  // A rollback is a new version that holds the document of an older one, so the history only grows
  async rollback(actorId: string, version: number, reason: string): Promise<BalanceChange> {
    const target = await this.require(version)
    return this.save(actorId, target.document, `Rollback to version ${version}: ${reason}`)
  }

  private async require(version: number): Promise<BalanceVersionRecord> {
    const record = await this.versions.find(version)

    if (!record) {
      throw new NotFoundError('No such balance version')
    }

    return record
  }

  private async activeBalance(): Promise<BalanceConfig> {
    const activeVersion = await this.versions.activeVersion()
    const active = activeVersion === null ? null : await this.versions.find(activeVersion)

    return applyBalance(this.base, active?.document ?? {})
  }
}
