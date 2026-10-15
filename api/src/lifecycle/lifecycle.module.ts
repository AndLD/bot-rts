import { Inject, Module, OnApplicationBootstrap, OnApplicationShutdown, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { EMAIL_SENDER, EmailSender } from '../notifications/application/email-sender'
import { NotificationsModule } from '../notifications/notifications.module'
import { UNIT_OF_WORK, UnitOfWork } from '../persistence/application/unit-of-work'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { NotificationService } from '../player-notifications/application/notification.service'
import { PlayerNotificationsModule } from '../player-notifications/player-notifications.module'
import { CLOCK, Clock } from '../shared/application/clock'
import { LOGGER, Logger } from '../shared/application/logger'
import { RETENTION_POLICY, RetentionPolicy } from '../retention/application/retention-settings.service'
import { TerminalCoreModule } from '../terminal/terminal-core.module'
import { INACTIVITY_NOTIFIER, InactivityNotifier } from './application/inactivity-notifier'
import { MetricCollectors } from '../metrics/application/metric-collectors'
import { collectLifecycleMetrics, LifecycleStatus } from './application/lifecycle-status'
import { LIFECYCLE_REPOSITORY, LifecycleRepository } from './application/lifecycle.repository'
import { LifecycleService } from './application/lifecycle.service'
import { LIFECYCLE_POLICY, LifecyclePolicy } from './domain/lifecycle-policy'
import { EmailInactivityNotifier } from './infrastructure/email-inactivity-notifier'
import { JOB_STATUS_STORE, JobStatusStore } from '../operations/application/ports'
import { PrismaOperationsStore } from '../operations/infrastructure/prisma-operations.store'
import { LifecycleScheduler } from './infrastructure/lifecycle-scheduler'
import { PrismaLifecycleRepository } from './infrastructure/prisma-lifecycle.repository'

export const LIFECYCLE_SERVICE = Symbol('LifecycleService')

// First pass shortly after start, so that a restarted node does not wait a whole interval
const FIRST_RUN_DELAY_MS = 60_000

// Runs on the node that owns the engine (`all` or `engine`), so that exactly one process cleans up
@Module({
  imports: [NotificationsModule, PlayerNotificationsModule, TerminalCoreModule],
  providers: [
    { provide: LIFECYCLE_POLICY, inject: [APP_CONFIG], useFactory: (config: AppConfig) => config.lifecycle },
    LifecycleStatus,
    {
      provide: JOB_STATUS_STORE,
      inject: [PRISMA_CLIENT, CLOCK],
      useFactory: (client: PrismaClient, clock: Clock) => new PrismaOperationsStore(client, clock)
    },
    {
      provide: LIFECYCLE_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaLifecycleRepository(client)
    },
    {
      provide: INACTIVITY_NOTIFIER,
      inject: [EMAIL_SENDER, APP_CONFIG],
      useFactory: (sender: EmailSender | undefined, config: AppConfig) =>
        new EmailInactivityNotifier(sender, config.frontendUrl)
    },
    {
      provide: LIFECYCLE_SERVICE,
      inject: [
        LIFECYCLE_REPOSITORY,
        UNIT_OF_WORK,
        INACTIVITY_NOTIFIER,
        NotificationService,
        RETENTION_POLICY,
        CLOCK,
        LifecycleStatus,
        JOB_STATUS_STORE,
        LOGGER
      ],
      useFactory: (
        repository: LifecycleRepository,
        unitOfWork: UnitOfWork,
        notifier: InactivityNotifier,
        notifications: NotificationService,
        settings: RetentionPolicy,
        clock: Clock,
        status: LifecycleStatus,
        jobs: JobStatusStore,
        logger: Logger
      ) =>
        new LifecycleService({
          repository,
          unitOfWork,
          notifier,
          notifications,
          settings,
          clock,
          status,
          jobs,
          logger
        })
    }
  ],
  exports: [LIFECYCLE_SERVICE, LifecycleStatus]
})
export class LifecycleModule implements OnModuleInit, OnApplicationBootstrap, OnApplicationShutdown {
  private scheduler: LifecycleScheduler | null = null

  constructor(
    @Inject(LIFECYCLE_SERVICE) private readonly service: LifecycleService,
    @Inject(LIFECYCLE_POLICY) private readonly policy: LifecyclePolicy,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly status: LifecycleStatus,
    private readonly collectors: MetricCollectors
  ) {}

  onModuleInit() {
    this.collectors.register(collectLifecycleMetrics(this.status))
  }

  onApplicationBootstrap() {
    if (this.policy.isEnabled && this.config.deployment.role !== 'api') {
      this.scheduler = new LifecycleScheduler(
        this.service.runOnce.bind(this.service),
        () => this.service.intervalMs(this.policy.intervalMs),
        FIRST_RUN_DELAY_MS
      )
      this.scheduler.start()
    }
  }

  onApplicationShutdown() {
    this.scheduler?.stop()
  }
}
