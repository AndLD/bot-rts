import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { AdminModule } from '../admin/admin.module'
import { AuthModule } from '../auth/auth.module'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { CONTROL_STATE_STORE, ControlStateStore } from '../engine/application/control-state'
import { ENGINE_PORT, EnginePort } from '../engine/application/engine-port'
import { PrismaControlStateStore } from '../engine/infrastructure/prisma-control-state.store'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { NotificationService } from '../player-notifications/application/notification.service'
import { PlayerNotificationsModule } from '../player-notifications/player-notifications.module'
import { CLOCK, Clock } from '../shared/application/clock'
import { OperationsService } from './application/operations.service'
import {
  ANNOUNCEMENT_RECIPIENTS,
  ANNOUNCER,
  Announcer,
  AnnouncementRecipients,
  BACKUP_STATUS_READER,
  BackupStatusReader,
  JOB_STATUS_STORE,
  JobStatusStore,
  MAINTENANCE_STORE,
  MaintenanceStore
} from './application/ports'
import { FileBackupStatusReader } from './infrastructure/file-backup-status.reader'
import { PrismaAnnouncementRecipients } from './infrastructure/prisma-announcement-recipients'
import { PrismaOperationsStore } from './infrastructure/prisma-operations.store'
import { MaintenanceController, OPERATIONS_SERVICE, OperationsController } from './presentation/operations.controller'

// The Operations page of the admin console, and the public maintenance status
@Module({
  imports: [AdminModule, AuthModule, PlayerNotificationsModule],
  controllers: [OperationsController, MaintenanceController],
  providers: [
    {
      provide: PrismaOperationsStore,
      inject: [PRISMA_CLIENT, CLOCK],
      useFactory: (client: PrismaClient, clock: Clock) => new PrismaOperationsStore(client, clock)
    },
    { provide: MAINTENANCE_STORE, useExisting: PrismaOperationsStore },
    { provide: JOB_STATUS_STORE, useExisting: PrismaOperationsStore },
    {
      provide: CONTROL_STATE_STORE,
      inject: [PRISMA_CLIENT, CLOCK],
      useFactory: (client: PrismaClient, clock: Clock) => new PrismaControlStateStore(client, clock)
    },
    {
      provide: BACKUP_STATUS_READER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => new FileBackupStatusReader(config.observability.backupStatusFile ?? null)
    },
    {
      provide: ANNOUNCEMENT_RECIPIENTS,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaAnnouncementRecipients(client)
    },
    {
      provide: ANNOUNCER,
      inject: [NotificationService],
      useFactory: (notifications: NotificationService): Announcer => ({
        announce: (userIds, text) => notifications.announce(userIds, text)
      })
    },
    {
      provide: OPERATIONS_SERVICE,
      inject: [
        ENGINE_PORT,
        CONTROL_STATE_STORE,
        MAINTENANCE_STORE,
        JOB_STATUS_STORE,
        BACKUP_STATUS_READER,
        ANNOUNCEMENT_RECIPIENTS,
        ANNOUNCER,
        CLOCK
      ],
      useFactory: (
        engine: EnginePort,
        controls: ControlStateStore,
        maintenance: MaintenanceStore,
        jobs: JobStatusStore,
        backup: BackupStatusReader,
        recipients: AnnouncementRecipients,
        announcer: Announcer,
        clock: Clock
      ) => new OperationsService(engine, controls, maintenance, jobs, backup, recipients, announcer, clock)
    }
  ]
})
export class OperationsModule {}
