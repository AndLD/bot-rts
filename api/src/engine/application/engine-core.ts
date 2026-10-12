import { ResultCode } from '../../../../lib/utils/result'
import { canRunScripts } from '../../bots/domain/capabilities'
import { ModuleRegistry } from '../../modules/domain/module-registry'
import { Clock } from '../../shared/application/clock'
import { IdGenerator } from '../../shared/application/id-generator'
import { Logger } from '../../shared/application/logger'
import { AppError } from '../../shared/domain/app-error'
import { ForbiddenError, NotFoundError } from '../../shared/domain/errors'
import { ENERGY_EVENT, EnergyEvent } from '../../modules/domain/energy-model'
import { BotState } from '../domain/bot-state'
import { EventParty } from '../domain/game-event'
import { capacityOf } from '../domain/bot-capacity'
import { shuffled } from '../domain/shuffle'
import { EngineConfig } from '../domain/engine-config'
import { Execution, ExecutionState, ExecutionStatus, ExecutionView } from '../domain/execution'
import { JsonValue } from '../domain/json-value'
import { ScriptFailure } from '../domain/script-failure'
import { SHELL_FILE, shellSource } from '../domain/shell-script'
import { ScriptMisuseError } from '../domain/script-misuse'
import { BotCapacities } from './bot-capacities'
import { EngineMetrics, EngineMetricsSnapshot } from './engine-metrics'
import { BotStateSource, EngineSink } from './engine-ports'
import type { StepWatch } from '../infrastructure/step-watch'
import { ModuleLoader } from './module-loader'
import { ExecutionRepository } from './execution.repository'
import { CallAnswer, EngineCommand, LiveExecution } from './live-execution'
import { Scheduler } from './scheduler'
import { CallOutcome, ScriptApi } from './script-api'
import { ScriptHost, ScriptRuntime } from './script-runtime'
import { WriteBehind } from './write-behind'
import { World, WorldBot } from './world/world'
import { EventOutbox } from './event-outbox'
import { GameEventBus } from './game-event-bus'
import { LiveVision } from './live-vision'
import { LinkStatus, RadioNetwork } from './radio-network'
import { WorldActionExecutor } from './world-action-executor'
import { controlledBotOf, WorldActionName } from './world-actions'
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
  modules: ModuleLoader
  // Tells the supervising thread which execution is being stepped, so that it can tell when one has stalled the engine
  watch?: StepWatch
  runtime: ScriptRuntime
  api: ScriptApi
  scheduler: Scheduler
  // Shared with the scheduler, which reads the parallel limits from it
  capacities: BotCapacities
  registry: ModuleRegistry
  writeBehind: WriteBehind
  world: World
  vision: LiveVision
  radio: RadioNetwork
  outbox: EventOutbox
  bus: GameEventBus
  actions: WorldActionExecutor
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
    await this.deps.vision.restore()
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

  // A use case that changes the world, run between ticks: the memory is written first, so the use case reads the truth, and
  // forgotten afterwards, since the use case may have changed any of it (design §14.2)
  act(name: WorldActionName, args: unknown[]): Promise<unknown> {
    return this.submit(async () => {
      const controlled = controlledBotOf(name, args)
      if (controlled) {
        await this.deps.radio.ensureControl(controlled.userId, controlled.botId)
      }
      await this.deps.world.sync()
      try {
        const result = await this.deps.actions.execute(name, args)
        if (name === 'access.adopt') {
          // The bot has another owner now: what its old owner left running stops with them
          await this.killAllOf(args[2] as string)
        }
        return result
      } finally {
        this.deps.world.evict()
      }
    })
  }

  private async killAllOf(botId: string): Promise<void> {
    for (const live of [...this.live.values()].filter((candidate) => candidate.record.botId === botId)) {
      await this.finish(live, ExecutionStatus.KILLED, 'killed')
    }
  }

  // Whether a bot reaches its base through the radio network, and how well (design §11.2.1)
  link(userId: string, botId: string): Promise<LinkStatus> {
    return this.submit(() => this.deps.radio.statusOf(userId, botId))
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

    this.deps.world.beginTick(tick)
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

    const isCut = await this.apply(commands, tick, hasTime)
    const now = this.deps.clock.now().getTime()
    for (const { bot, event } of this.deps.world.tickEnergy(now)) {
      this.tellEnergy(bot, event, now)
    }
    await this.deps.vision.refresh(tick, now)
    await this.deps.radio.refresh()
    this.deps.bus.deliver()
    await this.deps.writeBehind.flushIfDue(tick)
    this.deps.world.evictCold()

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
    const script =
      record.file === SHELL_FILE
        ? { source: shellSource(String(record.args[0])), modules: new Map<string, string>() }
        : await this.deps.modules.load(record.userId, record.botId, record.file)
    const rng = this.deps.createRng(this.deps.worldSeed ^ hash(record.id))
    // A script may write as much as its slice allows; what reaches the player and the database is limited per tick
    const { maxLinesPerTick, maxChars } = this.deps.config.log
    let writtenIn = { tick: -1, lines: 0 }
    const host: ScriptHost = {
      random: () => rng.next(),
      time: () => this.tickNumber * this.deps.config.tickIntervalMs,
      log: (args) => {
        writtenIn = writtenIn.tick === this.tickNumber ? writtenIn : { tick: this.tickNumber, lines: 0 }
        writtenIn.lines += 1
        if (writtenIn.lines <= maxLinesPerTick) {
          const text = args.map(format).join(' ')
          this.log(record, 'output', text.length > maxChars ? `${text.slice(0, maxChars)}… (cut)` : text)
        } else if (writtenIn.lines === maxLinesPerTick + 1) {
          this.log(record, 'system', `output cut: more than ${maxLinesPerTick} lines in one tick`)
        }
      }
    }
    this.learn(state)
    const execution = this.deps.runtime.createExecution({
      source: script.source,
      fileName: record.file,
      modules: script.modules,
      args: record.file === SHELL_FILE ? [] : [...record.args],
      // The modules are listed so that a script can name the one it switches (`bot.enable(id)`)
      identity: { id: record.botId, modules: state.modules.map(({ id, type, name }) => ({ id, type, name })) },
      functions: scriptFunctionsFor(state.modules.map((module) => module.type)),
      host,
      limits: { memoryBytes: this.deps.config.memoryBytes, stackBytes: this.deps.config.stackBytes }
    })
    return new LiveExecution(record, execution, this.tickNumber)
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
    this.deps.watch?.begin(live.record.id)
    let stepped
    try {
      stepped = live.step(tick, this.deps.config.sliceMs, this.deps.config.tickIntervalMs)
    } finally {
      this.deps.watch?.end()
    }
    const { outcome, commands } = stepped
    if (outcome.status === 'finished') {
      if (live.record.file === SHELL_FILE && outcome.value !== undefined) {
        this.log(live.record, 'output', format(outcome.value))
      }
      await this.finish(live, ExecutionStatus.FINISHED, null)
    } else if (outcome.status === 'failed') {
      await this.finish(live, ExecutionStatus.KILLED, describeFailure(outcome.failure))
      this.log(live.record, 'error', describeFailure(outcome.failure))
    }
    return commands
  }

  // Applies the game calls (design §12.4, §14.2). Collection is over, so the order no longer depends on who was run first: the
  // bots take their turns in a shuffle seeded by the tick, and the calls of one bot go oldest first, in the order of their
  // execution and call numbers. A bot's calls pass as far as its ops per tick allow (design §12.2.1); what does not fit, or
  // does not fit in the time left, waits for the next tick. The answers reach the scripts at the start of the next tick at the
  // earliest. Returns whether the time ran out.
  private async apply(commands: readonly EngineCommand[], tick: number, hasTime: () => boolean): Promise<boolean> {
    const queues = new Map<string, EngineCommand[]>()
    const queue = (botId: string) => queues.get(botId) ?? queues.set(botId, []).get(botId)!
    const fresh = [...commands].sort((a, b) => a.executionId.localeCompare(b.executionId) || a.callId - b.callId)
    for (const command of [...this.backlog, ...fresh]) {
      if (this.live.has(command.executionId)) {
        queue(command.botId).push(command)
      }
    }
    // The shuffle starts from a canonical order, so that it does not depend on how the commands were collected
    const order = shuffled(
      [...queues.keys()].sort(),
      this.deps.createRng(this.deps.worldSeed ^ Math.imul(tick, APPLY_SALT))
    )

    const waiting: EngineCommand[] = []
    let isCut = false
    for (const botId of order) {
      const budget = this.deps.capacities.get(botId).opsPerTick
      let used = 0
      for (const command of queues.get(botId) as EngineCommand[]) {
        // Scripts can only call the functions of the catalog
        const cost = (findScriptFunction(command.fn) as ScriptFunctionSpec).ops
        // A call dearer than a whole tick's budget would never run; it takes the budget of a tick alone
        if (isCut || (used > 0 && used + cost > budget) || budget === 0) {
          waiting.push(command)
        } else if (!hasTime()) {
          isCut = true
          waiting.push(command)
        } else {
          used += cost
          const { answer, delayTicks } = await this.answerFor(command)
          ;(this.live.get(command.executionId) as LiveExecution).answer(command.callId, answer, tick + 1 + delayTicks)
        }
      }
    }
    this.backlog = waiting
    return isCut
  }

  private async answerFor(command: EngineCommand): Promise<{ answer: CallAnswer; delayTicks: number }> {
    try {
      const bot = await this.deps.world.bot(command.botId)
      if (!bot) {
        return { answer: { value: failureValue(ResultCode.NOT_FOUND, 'The bot is gone') }, delayTicks: 0 }
      }
      this.learn(bot.state)
      const outcome = await this.deps.api.execute(bot.state, command.fn, command.args)
      return { answer: { value: valueOf(outcome) }, delayTicks: outcome.delayTicks ?? 0 }
    } catch (error) {
      if (error instanceof ScriptMisuseError) {
        return { answer: { misuse: error.message }, delayTicks: 0 }
      }
      this.deps.logger.error(error)
      return { answer: { misuse: 'Internal error' }, delayTicks: 0 }
    }
  }

  // Remembers what the bot's processors allow, as of the modules just read
  private learn(state: BotState): void {
    this.deps.capacities.set(state.bot.id, capacityOf(this.deps.registry.instantiateAll(state.modules)))
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
    const parties: [EventParty] = [{ userId: ended.userId, botId: ended.botId }]
    const at = this.deps.outbox.now()
    this.deps.outbox.publish(
      status === ExecutionStatus.FINISHED
        ? { type: 'ExecutionFinished', at, parties, executionId: ended.id }
        : { type: 'ExecutionFailed', at, parties, executionId: ended.id, reason: reason ?? 'killed' }
    )
    return execution
  }

  // The energy rules report what a bot should be told (design §12.5)
  private tellEnergy(bot: WorldBot, { type, moduleId }: EnergyEvent, now: number): void {
    const about = { at: now, parties: [{ userId: bot.state.ownerId, botId: bot.state.bot.id }] as [EventParty] }
    if (type === ENERGY_EVENT.LOW) {
      this.deps.outbox.publish({ ...about, type: 'EnergyLow' })
    } else if (type === ENERGY_EVENT.OUT_OF_FUEL) {
      this.deps.outbox.publish({ ...about, type: 'OutOfFuel', moduleId: moduleId as string })
    } else {
      this.deps.outbox.publish({ ...about, type: 'LiveScanStopped', moduleId: moduleId as string })
    }
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

const APPLY_SALT = 0x85ebca6b

// What the script gets for the outcome of a call: the same shape as a Result, so `r.ok` works (design §10.3)
function valueOf(outcome: CallOutcome): JsonValue {
  if (!outcome.ok) {
    return failureValue(outcome.code, outcome.msg)
  }
  return outcome.data === undefined ? { ok: true } : { ok: true, data: outcome.data }
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
