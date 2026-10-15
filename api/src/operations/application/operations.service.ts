import {
  IAnnouncementResult,
  IMaintenanceBanner,
  IMaintenanceStatus,
  IOperationsStatus,
  IRestartResult
} from '../../../../lib/utils/admin-operations'
import { ControlStateStore } from '../../engine/application/control-state'
import { EnginePort } from '../../engine/application/engine-port'
import { Clock } from '../../shared/application/clock'
import { ValidationError } from '../../shared/domain/errors'
import { bannerProblems, isBannerShown } from '../domain/maintenance'
import { Announcer, AnnouncementRecipients, BackupStatusReader, JobStatusStore, MaintenanceStore } from './ports'

const RECIPIENT_PAGE = 500
// The most running scripts the restart looks at: more than any node runs
const RESTART_SCAN = 100_000

export interface OperationsChange {
  before: unknown
  after: unknown
}

// The Operations page (design §25.3): what runs, the background jobs and the backup, announcements to the players, the banner of
// a scheduled maintenance, and the restart of the scripts. The pause of the world itself is on the Supervision page.
export class OperationsService {
  constructor(
    private readonly engine: EnginePort,
    private readonly controls: ControlStateStore,
    private readonly maintenance: MaintenanceStore,
    private readonly jobs: JobStatusStore,
    private readonly backup: BackupStatusReader,
    private readonly recipients: AnnouncementRecipients,
    private readonly announcer: Announcer,
    private readonly clock: Clock
  ) {}

  async status(): Promise<IOperationsStatus> {
    const [metrics, control, jobs, backup, banner] = await Promise.all([
      this.engine.metrics().then(
        (snapshot) => ({ isResponding: true, ...snapshot }),
        () => null
      ),
      this.controls.load(),
      this.jobs.list(),
      this.backup.read(),
      this.maintenance.get()
    ])

    return {
      engine: {
        isResponding: metrics !== null,
        uptimeMs: metrics?.uptimeMs ?? 0,
        tick: metrics?.tick ?? 0,
        lastTickMs: metrics?.lastTickMs ?? 0,
        p95TickMs: metrics?.p95TickMs ?? 0,
        executions: metrics?.executions ?? 0,
        memoryBytes: metrics?.memoryBytes ?? 0
      },
      isPaused: control.isPaused,
      areScriptsHalted: control.areScriptsHalted,
      jobs,
      backup,
      banner
    }
  }

  // What anyone may ask: whether the world is paused, and the banner while it should be shown
  async publicStatus(): Promise<IMaintenanceStatus> {
    const [control, banner] = await Promise.all([this.controls.load(), this.maintenance.get()])

    return { isPaused: control.isPaused, banner: isBannerShown(banner, this.clock.now().getTime()) ? banner : null }
  }

  async announce(text: string): Promise<IAnnouncementResult & OperationsChange> {
    let after: string | null = null
    let total = 0

    for (;;) {
      const ids: string[] = await this.recipients.page(after, RECIPIENT_PAGE)
      if (!ids.length) {
        break
      }
      await this.announcer.announce(ids, text)
      total += ids.length
      after = ids[ids.length - 1]
    }

    return { recipients: total, before: null, after: { text, recipients: total } }
  }

  async setBanner(banner: IMaintenanceBanner): Promise<OperationsChange> {
    const problems = bannerProblems(banner)

    if (problems.length) {
      throw new ValidationError(problems.join('; '))
    }
    const before = await this.maintenance.get()
    const stored = { ...banner, message: banner.message.trim() }
    await this.maintenance.save(stored)

    return { before, after: stored }
  }

  async clearBanner(): Promise<OperationsChange> {
    const before = await this.maintenance.get()
    await this.maintenance.save(null)

    return { before, after: null }
  }

  // Starts every running script again from the beginning, bot by bot; a bot that cannot be restarted (its owner is quarantined, the
  // world is paused) is counted and left as it is
  async restartRuntime(): Promise<IRestartResult & OperationsChange> {
    const running = await this.engine.top(RESTART_SCAN)
    const bots = [...new Set(running.map((usage) => usage.botId))]
    let restarted = 0
    let failedBots = 0

    for (const botId of bots) {
      try {
        restarted += (await this.engine.reboot(botId)).length
      } catch {
        failedBots += 1
      }
    }

    return { restarted, failedBots, before: { scripts: running.length }, after: { restarted, failedBots } }
  }
}
