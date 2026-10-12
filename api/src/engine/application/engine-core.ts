import { ResultCode } from '../../../../lib/utils/result'
import { canRunScripts } from '../../bots/domain/capabilities'
import { ModuleRegistry } from '../../modules/domain/module-registry'
import { Clock } from '../../shared/application/clock'
import { IdGenerator } from '../../shared/application/id-generator'
import { Logger } from '../../shared/application/logger'
import { AppError } from '../../shared/domain/app-error'
import { ForbiddenError, NotFoundError } from '../../shared/domain/errors'
import { BotState } from '../domain/bot-state'
import { capacityOf } from '../domain/bot-capacity'
import { EngineConfig } from '../domain/engine-config'
import { Execution, ExecutionState, ExecutionStatus, ExecutionView } from '../domain/execution'
import { JsonValue } from '../domain/json-value'
import { ScriptFailure } from '../domain/script-failure'
import { ScriptMisuseError } from '../domain/script-misuse'
import { BotCapacities } from './bot-capacities'
import { EngineMetrics, EngineMetricsSnapshot } from './engine-metrics'
import { BotStateSource, EngineSink, ScriptSource } from './engine-ports'
import { ExecutionRepository } from './execution.repository'
import { EngineCommand, LiveExecution } from './live-execution'
import { Scheduler } from './scheduler'
import { ScriptApi } from './script-api'
import { ScriptHost, ScriptRuntime } from './script-runtime'
import { WriteBehind } from './write-behind'
import { findScriptFunction, ScriptFunctionSpec, scriptFunctionsFor } from '../../../../lib/utils/script-api'
import { Rng } from '../../shared/application/rng'

export interface StartRequest {
  userId: string
  botId: string
  file: string
  args: JsonValue[]
}

export class ExecutionNotRunningError extends AppError {
  constructor() {
    super(404, ResultCode.NOT_FOUND, 'No such running execution')
  }
}

export interface EngineDependencies {
  config: EngineConfig
  worldSeed: number
  // A seeded random generator for the given seed (design §12.4)
  createRng: (seed: number) => Rng
  executions: ExecutionRepository
  bots: BotStateSource
  sources: ScriptSource
  runtime: ScriptRuntime
  api: ScriptApi
  scheduler: Scheduler
  // Shared with the scheduler, which reads the parallel limits from it
  capacities: BotCapacities
  registry: ModuleRegistry
  writeBehind: WriteBehind
  sink: EngineSink
  ids: IdGenerator
  clock: Clock
  logger: Logger
  // A monotonic wall clock in ms, used only to measure slices and tick duration
  monotonicMs: () => number
}

interface InboxItem {
  run(): Promise<unknown>
  resolve(value: unknown): void
  reject(error: unknown): void
}

// The engine (design §12.2.2): owns the executions, runs one tick at a time and is the only writer of their records.
// A tick settles the answers of the previous tick, runs the executions the scheduler picks, applies the game calls they
// made and writes the world behind. Requests from the API thread wait in an inbox and are served at the start of a tick.
export class EngineCore {
  private readonly live = new Map<string, LiveExecution>()
  private readonly inbox: InboxItem[] = []
  // Game calls the bots' op budgets have not let through yet, oldest first
  private backlog: EngineCommand[] = []
  private readonly metrics = new EngineMetrics()
  private tickNumber = 0

  constructor(private readonly deps: EngineDependencies) {}

  get tick(): number {
    return this.tickNumber
  }

  // After a restart: relaunches the executions that were active from the beginning of `main` (design §12.3.1), or
  // kills the ones that keep dying with the engine
  async recover(): Promise<void> {
    for (const record of await this.deps.executions.listActive()) {
      if (record.restarts >= this.deps.config.maxRestarts) {
        await this.end(record, ExecutionStatus.KILLED, 'crash-loop: the engine restarted too often while it ran')
        continue
      }
      const relaunched = { ...record, restarts: record.restarts + 1 }
      await this.deps.executions.update(relaunched)
      try {
        const state = await this.deps.bots.load(relaunched.botId)
        if (!state) {
          throw new NotFoundError('The bot is gone')
        }
        this.register(await this.build(relaunched, state))
        this.log(relaunched, 'system', 'rebooted: the engine restarted, the script starts again from main')
      } catch (error) {
        await this.end(relaunched, ExecutionStatus.KILLED, describe(error))
      }
    }
  }

  // A deliberate stop is not a crash: the restart counts are forgotten
  async shutdown(): Promise<void> {
    await this.deps.writeBehind.flush(this.tickNumber)
    for (const live of this.live.values()) {
      await this.deps.executions.update({ ...live.record, restarts: 0 })
      live.dispose()
    }
    this.live.clear()
  }

  start(request: StartRequest): Promise<ExecutionView> {
    return this.submit(async () => {
      const state = await this.deps.bots.loadControlled(request.userId, request.botId)
      if (!canRunScripts(this.deps.registry.instantiateAll(state.modules))) {
        throw new AppError(409, ResultCode.NO_MODULE, 'The bot has no working processor')
      }
      const record: Execution = {
        id: this.deps.ids.next(),
        botId: request.botId,
        userId: request.userId,
        file: request.file,
        args: request.args,
        status: ExecutionStatus.ACTIVE,
        restarts: 0,
        reason: null,
        createdAt: this.deps.clock.now(),
        endedAt: null
      }
      const live = await this.build(record, state)
      try {
        await this.deps.executions.add(record)
      } catch (error) {
        live.dispose()
        throw error
      }
      this.register(live)
      return live.view()
    })
  }

  kill(userId: string, executionId: string): Promise<ExecutionView> {
    return this.submit(async () => {
      const live = this.live.get(executionId)
      if (!live) {
        throw new ExecutionNotRunningError()
      }
      if (live.record.userId !== userId) {
        throw new ForbiddenError('The execution belongs to another player')
      }
      return this.finish(live, ExecutionStatus.KILLED, 'killed')
    })
  }

  list(userId: string): Promise<ExecutionView[]> {
    return this.submit(async () =>
      [...this.live.values()].filter((live) => live.record.userId === userId).map((live) => live.view())
    )
  }

  // The memory of every sandbox is measured on request, not every tick
  snapshot(): EngineMetricsSnapshot {
    const memoryBytes = [...this.live.values()].reduce((sum, live) => sum + live.memoryBytes(), 0)
    return { ...this.metrics.snapshot(), executions: this.live.size, memoryBytes }
  }

  // One game tick
  async runTick(): Promise<void> {
    const { config } = this.deps
    const startedAt = this.deps.monotonicMs()
    this.tickNumber += 1
    const tick = this.tickNumber

    await this.drainInbox()

    const planned = this.deps.scheduler.plan([...this.live.values()], tick)
    const cutoff = startedAt + config.tickIntervalMs * config.tickCapRatio
    const hasTime = () => this.deps.monotonicMs() < cutoff

    const commands: EngineCommand[] = []
    let reached = 0
    while (reached < planned.length && hasTime()) {
      commands.push(...(await this.runExecution(planned[reached], tick)))
      reached += 1
    }
    this.deps.scheduler.deferred(planned.slice(reached))

    const isCut = await this.apply(commands, hasTime)
    await this.deps.writeBehind.flushIfDue(tick)

    this.metrics.record({
      tick,
      durationMs: this.deps.monotonicMs() - startedAt,
      intervalMs: config.tickIntervalMs,
      isCut: isCut || reached < planned.length
    })
  }

  private submit<T>(run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.inbox.push({ run, resolve: resolve as (value: unknown) => void, reject })
    })
  }

  private async drainInbox(): Promise<void> {
    for (const item of this.inbox.splice(0)) {
      try {
        item.resolve(await item.run())
      } catch (error) {
        item.reject(error)
      }
    }
  }

  // Reads the script and prepares its sandbox; nothing is stored or registered yet
  private async build(record: Execution, state: BotState): Promise<LiveExecution> {
    const source = await this.deps.sources.read(record.userId, record.botId, record.file)
    const rng = this.deps.createRng(this.deps.worldSeed ^ hash(record.id))
    const host: ScriptHost = {
      random: () => rng.next(),
      time: () => this.tickNumber * this.deps.config.tickIntervalMs,
      log: (args) => this.log(record, 'output', args.map(format).join(' '))
    }
    this.learn(state)
    const script = this.deps.runtime.createExecution({
      source,
      fileName: record.file,
      args: [...record.args],
      identity: { id: record.botId },
      functions: scriptFunctionsFor(state.modules.map((module) => module.type)),
      host,
      limits: { memoryBytes: this.deps.config.memoryBytes, stackBytes: this.deps.config.stackBytes }
    })
    return new LiveExecution(record, script, this.tickNumber)
  }

  private register(live: LiveExecution): void {
    this.live.set(live.record.id, live)
    this.deps.sink.emit({ type: 'execution', userId: live.record.userId, execution: live.view() })
  }

  private async runExecution(live: LiveExecution, tick: number): Promise<EngineCommand[]> {
    live.settle(tick)
    if (live.record.restarts > 0 && tick - live.sinceTick >= this.deps.config.healthyTicks) {
      live.update({ ...live.record, restarts: 0 })
      await this.deps.executions.update(live.record)
    }
    if (!live.isRunnable) {
      return []
    }
    const { outcome, commands } = live.step(tick, this.deps.config.sliceMs, this.deps.config.tickIntervalMs)
    if (outcome.status === 'finished') {
      await this.finish(live, ExecutionStatus.FINISHED, null)
    } else if (outcome.status === 'failed') {
      await this.finish(live, ExecutionStatus.KILLED, describeFailure(outcome.failure))
      this.log(live.record, 'error', describeFailure(outcome.failure))
    }
    return commands
  }

  // Applies the game calls in the order they were made, as far as each bot's ops per tick allow (design §12.2.1); the answers
  // reach the scripts at the next tick. What does not fit, or does not fit in the time left, waits for the next tick.
  // Returns whether the time ran out.
  private async apply(commands: readonly EngineCommand[], hasTime: () => boolean): Promise<boolean> {
    const spent = new Map<string, number>()
    const waiting: EngineCommand[] = []
    let isCut = false
    for (const command of [...this.backlog, ...commands]) {
      const live = this.live.get(command.executionId)
      if (!live) {
        continue
      }
      const budget = this.deps.capacities.get(command.botId).opsPerTick
      // Scripts can only call the functions of the catalog
      const cost = (findScriptFunction(command.fn) as ScriptFunctionSpec).ops
      const used = spent.get(command.botId) ?? 0
      // A call dearer than a whole tick's budget would never run; it takes the budget of a tick alone
      if (isCut || (used > 0 && used + cost > budget) || budget === 0) {
        waiting.push(command)
        continue
      }
      if (!hasTime()) {
        isCut = true
        waiting.push(command)
        continue
      }
      spent.set(command.botId, used + cost)
      live.answer(command.callId, await this.answerFor(command))
    }
    this.backlog = waiting
    return isCut
  }

  private async answerFor(command: EngineCommand) {
    try {
      const state = await this.deps.bots.load(command.botId)
      if (!state) {
        return { value: failureValue(ResultCode.NOT_FOUND, 'The bot is gone') }
      }
      this.learn(state)
      return { value: await this.callApi(state, command) }
    } catch (error) {
      if (error instanceof ScriptMisuseError) {
        return { misuse: error.message }
      }
      this.deps.logger.error(error)
      return { misuse: 'Internal error' }
    }
  }

  // Remembers what the bot's processors allow, as of the modules just read
  private learn(state: BotState): void {
    this.deps.capacities.set(state.bot.id, capacityOf(this.deps.registry.instantiateAll(state.modules)))
  }

  private async callApi(state: BotState, command: EngineCommand): Promise<JsonValue | undefined> {
    const outcome = await this.deps.api.execute(state, command.fn, command.args)
    if (!outcome.ok) {
      return failureValue(outcome.code, outcome.msg)
    }
    return outcome.data === undefined ? { ok: true } : { ok: true, data: outcome.data }
  }

  private async finish(live: LiveExecution, status: ExecutionStatus, reason: string | null): Promise<ExecutionView> {
    this.live.delete(live.record.id)
    live.dispose()
    if (![...this.live.values()].some((other) => other.record.botId === live.record.botId)) {
      this.deps.capacities.forget(live.record.botId)
    }
    return this.end(live.record, status, reason)
  }

  private async end(record: Execution, status: ExecutionStatus, reason: string | null): Promise<ExecutionView> {
    const ended: Execution = { ...record, status, reason, endedAt: this.deps.clock.now() }
    await this.deps.executions.update(ended)
    const execution: ExecutionView = {
      id: ended.id,
      botId: ended.botId,
      file: ended.file,
      args: ended.args,
      state: status === ExecutionStatus.FINISHED ? ExecutionState.FINISHED : ExecutionState.KILLED,
      reason,
      restarts: ended.restarts
    }
    this.deps.sink.emit({ type: 'execution', userId: ended.userId, execution })
    return execution
  }

  private log(record: Execution, kind: 'output' | 'error' | 'system', text: string): void {
    this.deps.sink.emit({
      type: 'log',
      executionId: record.id,
      botId: record.botId,
      userId: record.userId,
      kind,
      text
    })
  }
}

// A failure as the script sees it: the same shape as a Result, so `r.ok` works (design §10.3)
function failureValue(code: string, msg: string): JsonValue {
  return { ok: false, code, msg }
}

function describeFailure(failure: ScriptFailure): string {
  return `${failure.code}: ${failure.message}`
}

function describe(error: unknown): string {
  return (error as Error).message
}

function format(value: JsonValue): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function hash(text: string): number {
  let value = 0
  for (let i = 0; i < text.length; i++) {
    value = (Math.imul(value, 31) + text.charCodeAt(i)) | 0
  }
  return value
}
