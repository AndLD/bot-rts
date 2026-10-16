import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { PrismaClient } from '@prisma/client'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { LOGGER, Logger } from '../shared/application/logger'
import { TRACING, Tracing } from '../shared/application/tracing'
import { ENGINE_PORT, EnginePort } from './application/engine-port'
import { PrismaExecutionRepository } from './infrastructure/prisma-execution.repository'
import { killStalled } from './infrastructure/kill-stalled'
import { createStepWatchBuffer, StepWatchReader } from './infrastructure/step-watch'
import { EngineProcess } from './infrastructure/engine-process'
import { spawnEngineWorker } from './infrastructure/engine-worker-launcher'
import { DisabledEnginePort } from './infrastructure/worker-engine-port'
import { REDIS_CONNECTOR, RedisConnector } from '../redis/redis.module'
import { RedisEngineBridge } from '../redis/infrastructure/redis-engine-bridge'
import { RedisEnginePort } from '../redis/infrastructure/redis-engine-port'

export const ENGINE_PROCESS = Symbol('EngineProcess')
const ENGINE_BRIDGE = Symbol('EngineBridge')

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
      inject: [APP_CONFIG, LOGGER, PRISMA_CLIENT, TRACING],
      useFactory: async (config: AppConfig, logger: Logger, client: PrismaClient, tracing: Tracing) => {
        // An `api` node leaves the engine to the engine node (design §12.2.2)
        if (!config.engine.isEnabled || config.deployment.role === 'api') {
          return null
        }
        // The engine thread must not start an engine of its own
        const workerConfig = {
          ...config,
          engine: { ...config.engine, isEnabled: false },
          deployment: { ...config.deployment, role: 'all' as const, redisUrl: undefined },
          smtp: undefined
        }
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
          tracing,
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
      inject: [ENGINE_PROCESS, APP_CONFIG, REDIS_CONNECTOR, TRACING],
      useFactory: async (
        process: EngineProcess | null,
        config: AppConfig,
        connect: RedisConnector,
        tracing: Tracing
      ) => {
        if (config.deployment.role === 'api' && config.engine.isEnabled && connect) {
          const port = new RedisEnginePort(connect(), connect(), config.deployment.engineRequestTimeoutMs, tracing)
          await port.open()
          return port
        }
        return process?.port ?? new DisabledEnginePort()
      }
    },
    {
      provide: ENGINE_BRIDGE,
      inject: [ENGINE_PORT, APP_CONFIG, REDIS_CONNECTOR, LOGGER, TRACING],
      useFactory: async (
        engine: EnginePort,
        config: AppConfig,
        connect: RedisConnector,
        logger: Logger,
        tracing: Tracing
      ) => {
        if (config.deployment.role !== 'engine' || !config.engine.isEnabled || !connect) {
          return null
        }
        const bridge = new RedisEngineBridge(engine, connect(), connect(), logger, tracing)
        await bridge.open()
        return bridge
      }
    }
  ],
  exports: [ENGINE_PORT, ENGINE_PROCESS]
})
export class EngineModule implements OnApplicationShutdown {
  constructor(
    @Inject(ENGINE_PROCESS) private readonly process: EngineProcess | null,
    @Inject(ENGINE_PORT) private readonly port: EnginePort,
    @Inject(ENGINE_BRIDGE) _bridge: RedisEngineBridge | null
  ) {}

  async onApplicationShutdown() {
    if (this.port instanceof RedisEnginePort) {
      this.port.close()
    }
    await this.process?.close()
  }
}
