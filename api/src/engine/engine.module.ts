import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { PrismaClient } from '@prisma/client'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { LOGGER, Logger } from '../shared/application/logger'
import { ENGINE_PORT } from './application/engine-port'
import { ExecutionRepository } from './application/execution.repository'
import { ExecutionStatus } from './domain/execution'
import { PrismaExecutionRepository } from './infrastructure/prisma-execution.repository'
import { createStepWatchBuffer, StepWatchReader } from './infrastructure/step-watch'
import { EngineProcess } from './infrastructure/engine-process'
import { spawnEngineWorker } from './infrastructure/engine-worker-launcher'
import { DisabledEnginePort } from './infrastructure/worker-engine-port'

export const ENGINE_PROCESS = Symbol('EngineProcess')

// What the supervisor does for the script that held the engine thread: the record says it was killed, so that the next engine does
// not start it again, and its player is told why
async function killStalled(
  executions: ExecutionRepository,
  process: EngineProcess,
  executionId: string
): Promise<void> {
  const record = await executions.findById(executionId)
  if (!record || record.status !== ExecutionStatus.ACTIVE) {
    return
  }
  const reason = 'stalled the engine'
  await executions.update({ ...record, status: ExecutionStatus.KILLED, reason, endedAt: new Date() })
  process.announce({
    type: 'log',
    executionId,
    botId: record.botId,
    userId: record.userId,
    kind: 'error',
    text: `killed: the script ${reason}`
  })
}

const READY_TIMEOUT_MS = 60_000
const STOP_TIMEOUT_MS = 10_000
const RESPAWN_DELAY_MS = 1_000

// The API thread's door to the engine thread (design §12.2.2): the engine runs in a worker thread of this process and
// is reached only through `ENGINE_PORT`. With the engine switched off the port answers "unavailable".
@Global()
@Module({
  providers: [
    {
      provide: ENGINE_PROCESS,
      inject: [APP_CONFIG, LOGGER, PRISMA_CLIENT],
      useFactory: async (config: AppConfig, logger: Logger, client: PrismaClient) => {
        if (!config.engine.isEnabled) {
          return null
        }
        // The engine thread must not start an engine of its own
        const workerConfig = { ...config, engine: { ...config.engine, isEnabled: false }, smtp: undefined }
        const stepWatch = createStepWatchBuffer()
        const executions = new PrismaExecutionRepository(client)
        const process: EngineProcess = new EngineProcess({
          spawn: () => spawnEngineWorker(workerConfig, __filename.endsWith('.ts'), stepWatch),
          watchdog: {
            reader: new StepWatchReader(stepWatch),
            stallMs: config.engine.watchdog.stallMs,
            pollMs: config.engine.watchdog.pollMs,
            onStall: (executionId) => killStalled(executions, process, executionId)
          },
          logger,
          readyTimeoutMs: READY_TIMEOUT_MS,
          stopTimeoutMs: STOP_TIMEOUT_MS,
          respawnDelayMs: RESPAWN_DELAY_MS
        })
        await process.start()
        return process
      }
    },
    {
      provide: ENGINE_PORT,
      inject: [ENGINE_PROCESS],
      useFactory: (process: EngineProcess | null) => process?.port ?? new DisabledEnginePort()
    }
  ],
  exports: [ENGINE_PORT]
})
export class EngineModule implements OnApplicationShutdown {
  constructor(@Inject(ENGINE_PROCESS) private readonly process: EngineProcess | null) {}

  async onApplicationShutdown() {
    await this.process?.close()
  }
}
