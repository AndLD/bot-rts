import { Module } from '@nestjs/common'
import { AdminModule } from '../admin/admin.module'
import { AuthModule } from '../auth/auth.module'
import { ENGINE_PORT, EnginePort } from '../engine/application/engine-port'
import { LOG_BUFFER, LogBuffer } from '../shared/application/log-buffer'
import { LogsService } from './application/logs.service'
import { LOGS_SERVICE, LogsController } from './presentation/logs.controller'

// The log search and the slow-tick traces of the admin console; the audit trail is part of the admin module
@Module({
  imports: [AdminModule, AuthModule],
  controllers: [LogsController],
  providers: [
    {
      provide: LOGS_SERVICE,
      inject: [LOG_BUFFER, ENGINE_PORT],
      useFactory: (buffer: LogBuffer, engine: EnginePort) => new LogsService(buffer, engine)
    }
  ]
})
export class LogsModule {}
