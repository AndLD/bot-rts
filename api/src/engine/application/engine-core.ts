import { ResultCode } from '../../../../lib/utils/result'
import { canRunScripts } from '../../bots/domain/capabilities'
import { ModuleRegistry } from '../../modules/domain/module-registry'
import { Clock } from '../../shared/application/clock'
import { IdGenerator } from '../../shared/application/id-generator'
import { Logger } from '../../shared/application/logger'
import { NO_TRACING, Span, Tracing } from '../../shared/application/tracing'
import { AppError } from '../../shared/domain/app-error'
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/domain/errors'
import { ControlState, EngineControl, INITIAL_CONTROL_STATE } from '../domain/engine-control'
import {
  ManualCategoryDisabledError,
  MaintenanceModeError,
  PlayerQuarantinedError,
  ScriptsHaltedError
} from '../domain/engine.errors'
import { ControlStateStore } from './control-state'
import { ENERGY_EVENT, EnergyEvent } from '../../modules/domain/energy-model'
import { BotState } from '../domain/bot-state'
import { EventParty } from '../domain/game-event'
import { capacityOf } from '../domain/bot-capacity'
import { shuffled } from '../domain/shuffle'
import { EngineConfig } from '../domain/engine-config'
import { Execution, ExecutionState, ExecutionStatus, ExecutionUsage, ExecutionView } from '../domain/execution'
import { JsonValue } from '../domain/json-value'
import { ScriptFailure, ScriptFailureCode } from '../domain/script-failure'
import { SHELL_FILE, shellSource } from '../domain/shell-script'
import { ScriptMisuseError } from '../domain/script-misuse'
import { BotCapacities } from './bot-capacities'
import { ENGINE_COUNTER, ENGINE_GAUGE, EngineMetrics, EngineMetricsSnapshot } from './engine-metrics'
import { BotStateSource, EngineSink, ManualPolicy } from './engine-ports'
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
import { ACTION_CATEGORIES, controlledBotOf, WorldActionName } from './world-actions'
import { BotPasswordWrongError } from '../../terminal/domain/terminal.errors'
import { worldActionEvents } from './world-action-events'
import { categoryOfFunction, ManualCategory } from '../../../../lib/utils/interfaces/settings'
import { findScriptFunction, ScriptFunctionSpec, scriptFunctionsFor } from '../../../../lib/utils/script-api'
import { Rng } from '../../shared/application/rng'

export interface StartRequest {
  userId: string
  botId: string
  file: string
  args: JsonValue[]
}

// A call the player makes by hand (design §15.1): it waits for the bot's ops like a script's call and is answered when applied
interface ManualCall {
  resolve(value: JsonValue): void
  reject(error: unknown): void
  // The trace of the request the call came in with, which applying the call continues
  traceparent: string | undefined
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
  controls: ControlStateStore
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
  // Which categories of manual control a player has switched on; scripts are never held back by it
  manualPolicy: ManualPolicy
  sink: EngineSink
  ids: IdGenerator
  clock: Clock
  // The clock of the rules (the energy of the bots); the real one is used for the records of executions. Defaults to `clock`.
  gameClock?: Clock
  logger: Logger
  // Spans for the ticks, the requests the engine serves and the executions; without it nothing is traced
  tracing?: Tracing
  // Where the engine and its parts record their counters and gauges; the engine makes its own when none is given
  metrics?: EngineMetrics
  // A monotonic wall clock in ms, used only to measure slices and tick duration
  monotonicMs: () => number
}

interface InboxItem {
  // What the request is, for the span it runs in
  label: string
  // The trace of the request, which the work continues when the tick takes it up
  traceparent: string | undefined
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
  private readonly manualCalls = new Map<string, ManualCall>()
  // A manual action that takes time keeps the bot busy: the next one waits, as a script waits for the answer of its call
  private readonly busyUntil = new Map<string, number>()
  // Game calls the bots' op budgets have not let through yet, oldest first
  private backlog: EngineCommand[] = []
  private readonly metrics: EngineMetrics
  // When the last tick began (ms), to see a tick that the loop did not run; none after a pause
  private lastTickAt: number | null = null
  private readonly waitedTicks = new Map<string, number>()
  private tickNumber = 0
  private controlState: ControlState = INITIAL_CONTROL_STATE

  // The span of each running execution: a trace of its own, linked to the request that started it
  private readonly executionSpans = new Map<string, Span>()
  private readonly tracing: Tracing
  private readonly startedAtMs: number

  constructor(private readonly deps: EngineDependencies) {
    this.startedAtMs = deps.monotonicMs()
    this.tracing = deps.tracing ?? NO_TRACING
    this.metrics = deps.metrics ?? new EngineMetrics()
  }

  get tick(): number {
    return this.tickNumber
  }

  // After a restart: relaunches the executions that were active from the beginning of `main` (design §12.3.1), or
  // kills the ones that keep dying with the engine
  async recover(): Promise<void> {
    this.controlState = await this.deps.controls.load()
    await this.deps.vision.restore()
    for (const record of await this.deps.executions.listActive()) {
      if (record.restarts >= this.deps.config.maxRestarts) {
        this.metrics.count(ENGINE_COUNTER.crashLoopKills)
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
      this.endExecutionSpan(live.record.id)
    }
    this.live.clear()
  }

  start(request: StartRequest): Promise<ExecutionView> {
    return this.submit('start', () => {
      this.assertMayStart(request.userId)
      return this.launch(request)
    })
  }

  private async launch(request: StartRequest): Promise<ExecutionView> {
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
  }

  // A script may start unless the world is paused, scripts are halted, or the player is quarantined (design §25.3)
  private assertMayStart(userId: string): void {
    this.assertMayAct(userId)
    if (this.controlState.areScriptsHalted) {
      throw new ScriptsHaltedError()
    }
  }

  private assertMayAct(userId: string): void {
    if (this.controlState.isPaused) {
      throw new MaintenanceModeError()
    }
    if (this.controlState.quarantined.includes(userId)) {
      throw new PlayerQuarantinedError()
    }
  }

  // Maintenance, the script kill-switch and quarantine, from the console. Switching the kill-switch on kills every running
  // script; a quarantined player's scripts are only held, and go on when the quarantine ends.
  control(command: EngineControl): Promise<ControlState> {
    return this.submit('control', async () => {
      const next = this.nextControl(command)
      await this.deps.controls.save(next)
      const wasHalted = this.controlState.areScriptsHalted
      this.controlState = next
      if (next.areScriptsHalted && !wasHalted) {
        for (const live of [...this.live.values()]) {
          await this.finish(live, ExecutionStatus.KILLED, 'killed: scripts were switched off by an admin')
        }
      }

      return { ...next, quarantined: [...next.quarantined] }
    })
  }

  private nextControl(command: EngineControl): ControlState {
    const current = this.controlState
    switch (command.type) {
      case 'pause':
        return { ...current, isPaused: true }
      case 'resume':
        return { ...current, isPaused: false }
      case 'halt-scripts':
        return { ...current, areScriptsHalted: command.isOn }
      default:
        return {
          ...current,
          quarantined: command.isOn
            ? [...new Set([...current.quarantined, command.userId])]
            : current.quarantined.filter((userId) => userId !== command.userId)
        }
    }
  }

  // Restarts what runs on a bot: each script is killed and started again from the beginning
  reboot(botId: string): Promise<ExecutionView[]> {
    return this.submit('reboot', async () => {
      const running = [...this.live.values()].filter((live) => live.record.botId === botId)
      for (const { record } of running) {
        this.assertMayStart(record.userId)
      }
      const restarted: ExecutionView[] = []
      for (const live of running) {
        const { userId, file, args } = live.record
        await this.finish(live, ExecutionStatus.KILLED, 'killed: the bot was rebooted by an admin')
        restarted.push(await this.launch({ userId, botId, file, args: [...args] }))
      }

      return restarted
    })
  }

  // A manual action: any call of the script API done by hand (design §15.1). It follows the rules of a script's call: the bot
  // needs a working processor and the module the call needs, the call costs ops from the same per-tick budget and is applied
  // in the same turn order, and it takes the same time. The answer is the one a script would get.
  manual(userId: string, botId: string, fn: string, args: JsonValue[]): Promise<JsonValue> {
    return new Promise<JsonValue>((resolve, reject) => {
      this.submit('manual', async () => {
        this.assertMayAct(userId)
        const spec = findScriptFunction(fn)
        if (!spec || spec.isScheduled) {
          throw new ValidationError(`Unknown action: ${fn}`)
        }
        await this.requireCategory(userId, categoryOfFunction(fn))
        await this.deps.radio.ensureControl(userId, botId)
        const state = await this.deps.bots.loadControlled(userId, botId)
        if (!canRunScripts(this.deps.registry.instantiateAll(state.modules))) {
          throw new AppError(409, ResultCode.NO_MODULE, 'The bot has no working processor')
        }
        this.learn(state)
        const executionId = `manual:${this.deps.ids.next()}`
        this.manualCalls.set(executionId, { resolve, reject, traceparent: this.tracing.traceparent() })
        this.backlog.push({ executionId, botId, callId: 0, fn, args })
      }).catch(reject)
    })
  }

  kill(userId: string, executionId: string): Promise<ExecutionView> {
    return this.submit('kill', async () => {
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
    return this.submit(`act ${name}`, async () => {
      // The support actions of the admins are the way back from a pause or a quarantine, so they are not held by either
      if (!name.startsWith('support.')) {
        this.assertMayAct(String(args[0]))
      }
      const controlled = controlledBotOf(name, args)
      if (controlled) {
        await this.requireCategory(controlled.userId, ACTION_CATEGORIES[name])
        await this.deps.radio.ensureControl(controlled.userId, controlled.botId)
      }
      await this.deps.world.sync()
      try {
        const result = await this.deps.actions.execute(name, args)
        for (const event of worldActionEvents(name, args, result, this.deps.outbox.now())) {
          this.deps.outbox.publish(event)
        }
        if (name === 'access.adopt') {
          // The bot has another owner now: what its old owner left running stops with them
          await this.killAllOf(args[2] as string)
        }
        return result
      } catch (error) {
        this.publishFailedAttempt(error, args)
        throw error
      } finally {
        this.deps.world.evict()
      }
    })
  }

  // A wrong password on a bot is news for the bot's owner (design §24.2), even though the one who tried only gets an error
  private publishFailedAttempt(error: unknown, args: readonly unknown[]): void {
    if (error instanceof BotPasswordWrongError && error.attempt?.ownerId) {
      const { targetBotId, ownerId, isLockedOut } = error.attempt

      this.deps.outbox.publish({
        type: 'PasswordAttemptFailed',
        at: this.deps.outbox.now(),
        parties: [
          { userId: ownerId, botId: targetBotId },
          { userId: args[0] as string, botId: args[1] as string }
        ],
        isLockedOut
      })
    }
  }

  // Manual control of a category the game or the player has switched off is refused here, not only hidden in the UI
  private async requireCategory(userId: string, category: ManualCategory | null): Promise<void> {
    if (category && !(await this.deps.manualPolicy.isAllowed(userId, category))) {
      throw new ManualCategoryDisabledError(category)
    }
  }

  private async killAllOf(botId: string): Promise<void> {
    for (const live of [...this.live.values()].filter((candidate) => candidate.record.botId === botId)) {
      await this.finish(live, ExecutionStatus.KILLED, 'killed')
    }
  }

  // Whether a bot reaches its base through the radio network, and how well (design §11.2.1)
  link(userId: string, botId: string): Promise<LinkStatus> {
    return this.submit('link', () => this.deps.radio.statusOf(userId, botId))
  }

  list(userId: string): Promise<ExecutionView[]> {
    return this.submit('list', async () =>
      [...this.live.values()].filter((live) => live.record.userId === userId).map((live) => live.view())
    )
  }

  // The running scripts that made the most calls, the biggest first
  top(limit: number): Promise<ExecutionUsage[]> {
    return this.submit('top', async () =>
      [...this.live.values()]
        .sort((a, b) => b.opsUsed - a.opsUsed)
        .slice(0, limit)
        .map((live) => ({
          id: live.record.id,
          userId: live.record.userId,
          botId: live.record.botId,
          file: live.record.file,
          opsUsed: live.opsUsed,
          ticks: this.tickNumber - live.sinceTick
        }))
    )
  }

  // The memory of every sandbox is measured on request, not every tick
  snapshot(): EngineMetricsSnapshot {
    const memoryBytes = [...this.live.values()].reduce((sum, live) => sum + live.memoryBytes(), 0)
    return {
      ...this.metrics.snapshot(),
      executions: this.live.size,
      memoryBytes,
      uptimeMs: this.deps.monotonicMs() - this.startedAtMs
    }
  }

  // One game tick, in a trace of its own
  runTick(): Promise<void> {
    return this.tracing.withSpan('engine.tick', { isRoot: true }, (span) => this.runOneTick(span))
  }

  private async runOneTick(span: Span): Promise<void> {
    if (this.controlState.isPaused) {
      // Maintenance: requests are still answered (the console resumes the world through one), but nothing moves
      await this.drainInbox()
      this.lastTickAt = null
      return
    }
    const { config } = this.deps
    const startedAt = this.deps.monotonicMs()
    this.countSkipped(startedAt)
    this.tickNumber += 1
    const tick = this.tickNumber
    span.setAttribute('botrts.tick', tick)

    this.deps.world.beginTick(tick)
    await this.drainInbox()

    const held = new Set(this.controlState.quarantined)
    const planned = this.deps.scheduler.plan(
      [...this.live.values()].filter((live) => !held.has(live.record.userId)),
      tick
    )
    const cutoff = startedAt + config.tickIntervalMs * config.tickCapRatio
    const hasTime = () => this.deps.monotonicMs() < cutoff

    const commands: EngineCommand[] = []
    let reached = 0
    while (reached < planned.length && hasTime()) {
      commands.push(...(await this.runExecution(planned[reached], tick)))
      reached += 1
    }
    this.deps.scheduler.deferred(planned.slice(reached))
    const maxWaitTicks = this.trackWaiting(planned, planned.slice(0, reached))

    const isCut = await this.apply(commands, tick, hasTime)
    const now = (this.deps.gameClock ?? this.deps.clock).now().getTime()
    for (const { bot, event } of this.deps.world.tickEnergy(now)) {
      this.tellEnergy(bot, event, now)
    }
    await this.deps.vision.refresh(tick, now)
    await this.deps.radio.refresh()
    this.deps.bus.deliver()
    await this.deps.writeBehind.flushIfDue(tick)
    this.deps.world.evictCold()
    this.metrics.gauge(ENGINE_GAUGE.flushLagTicks, this.deps.writeBehind.ticksSinceFlush(tick))
    this.recordPopulation()

    this.metrics.record({
      tick,
      durationMs: this.deps.monotonicMs() - startedAt,
      intervalMs: config.tickIntervalMs,
      isCut: isCut || reached < planned.length,
      queuedExecutions: this.live.size - planned.length,
      deferredExecutions: planned.length - reached,
      maxWaitTicks,
      traceId: span.context?.traceId ?? null
    })
  }

  // The loop keeps its rate and does not make up a tick that came late by more than an interval: those ticks never ran
  private countSkipped(startedAt: number): void {
    const { tickIntervalMs } = this.deps.config
    if (this.lastTickAt !== null) {
      const missed = Math.round((startedAt - this.lastTickAt) / tickIntervalMs) - 1
      if (missed > 0) {
        this.metrics.count(ENGINE_COUNTER.ticksSkipped, missed)
      }
    }
    this.lastTickAt = startedAt
  }

  // How many bots and players have a script running
  private recordPopulation(): void {
    const executions = [...this.live.values()]

    this.metrics.gauge(ENGINE_GAUGE.activeBots, new Set(executions.map((live) => live.record.botId)).size)
    this.metrics.gauge(ENGINE_GAUGE.activePlayers, new Set(executions.map((live) => live.record.userId)).size)
  }

  // Counts how many ticks in a row each planned execution was kept from running by the tick cap, and returns the longest wait.
  // An execution waiting for the end of another one of its bot (queued) is not waiting for the scheduler and is not counted.
  private trackWaiting(planned: readonly LiveExecution[], stepped: readonly LiveExecution[]): number {
    const served = new Set(stepped.map((live) => live.record.id))
    const waited = new Map<string, number>()
    let longest = 0

    for (const { record } of planned) {
      const ticks = served.has(record.id) ? 0 : (this.waitedTicks.get(record.id) ?? 0) + 1
      waited.set(record.id, ticks)
      longest = Math.max(longest, ticks)
    }
    this.waitedTicks.clear()
    waited.forEach((ticks, id) => this.waitedTicks.set(id, ticks))
    this.recordWaitSpread(planned, waited)

    return longest
  }

  // The difference between the player who has waited longest for a turn and the one who has waited least (fairness between players)
  private recordWaitSpread(planned: readonly LiveExecution[], waited: ReadonlyMap<string, number>): void {
    const longestOfPlayer = new Map<string, number>()
    for (const { record } of planned) {
      longestOfPlayer.set(record.userId, Math.max(longestOfPlayer.get(record.userId) ?? 0, waited.get(record.id) ?? 0))
    }
    const waits = [...longestOfPlayer.values()]

    this.metrics.gauge(ENGINE_GAUGE.waitSpreadTicks, waits.length ? Math.max(...waits) - Math.min(...waits) : 0)
  }

  private submit<T>(label: string, run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.inbox.push({
        label,
        traceparent: this.tracing.traceparent(),
        run,
        resolve: resolve as (value: unknown) => void,
        reject
      })
    })
  }

  private async drainInbox(): Promise<void> {
    for (const item of this.inbox.splice(0)) {
      try {
        item.resolve(
          await this.tracing.withSpan(`engine.${item.label}`, { parent: item.traceparent }, () => item.run())
        )
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
    this.executionSpans.set(
      live.record.id,
      this.tracing.startSpan('script.execution', {
        isRoot: true,
        links: this.linksToCurrent(),
        attributes: {
          'botrts.execution_id': live.record.id,
          'botrts.bot_id': live.record.botId,
          'botrts.file': live.record.file
        }
      })
    )
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
    if (outcome.status === 'failed' && outcome.failure.code === ScriptFailureCode.TIME_LIMIT) {
      this.metrics.count(ENGINE_COUNTER.killedBySlice)
    }
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
      if (this.live.has(command.executionId) || this.manualCalls.has(command.executionId)) {
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
        const isBusy = this.manualCalls.has(command.executionId) && (this.busyUntil.get(botId) ?? 0) > tick
        // A call dearer than a whole tick's budget would never run; it takes the budget of a tick alone
        if (isCut || isBusy || (used > 0 && used + cost > budget) || budget === 0) {
          waiting.push(command)
        } else if (!hasTime()) {
          isCut = true
          waiting.push(command)
        } else {
          used += cost
          this.metrics.count(ENGINE_COUNTER.commandsApplied)
          const manual = this.manualCalls.get(command.executionId)
          // A manual call is applied in the trace of the request that made it; a script's call, in the tick
          const { answer, delayTicks } = manual
            ? await this.tracing.withSpan(`engine.call ${command.fn}`, { parent: manual.traceparent }, () =>
                this.answerFor(command)
              )
            : await this.answerFor(command)
          if (manual) {
            this.manualCalls.delete(command.executionId)
            this.busyUntil.set(botId, tick + 1 + delayTicks)
            this.settleManual(manual, answer)
          } else {
            const live = this.live.get(command.executionId) as LiveExecution
            live.answer(command.callId, answer, tick + 1 + delayTicks)
          }
        }
      }
      if (used > 0) {
        this.metrics.count(ENGINE_COUNTER.opsUsed, used)
        this.metrics.count(ENGINE_COUNTER.opsBudget, budget)
      }
    }
    this.backlog = waiting
    return isCut
  }

  private settleManual(call: ManualCall, answer: CallAnswer): void {
    if ('misuse' in answer) {
      call.reject(new ValidationError(answer.misuse))
    } else {
      call.resolve(answer.value as JsonValue)
    }
  }

  private async answerFor(command: EngineCommand): Promise<{ answer: CallAnswer; delayTicks: number }> {
    try {
      const bot = await this.deps.world.bot(command.botId)
      if (!bot) {
        return { answer: { value: failureValue(ResultCode.NOT_FOUND, 'The bot is gone') }, delayTicks: 0 }
      }
      this.learn(bot.state)
      const outcome = await this.deps.api.execute(bot.state, command.fn, command.args)
      if (!outcome.ok && (outcome.code === ResultCode.BLOCKED || outcome.code === ResultCode.EMPTY)) {
        this.metrics.count(ENGINE_COUNTER.conflicts)
      }
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

  // A long script is related to the call that started it, not a part of it
  private linksToCurrent(): string[] {
    const current = this.tracing.traceparent()

    return current ? [current] : []
  }

  private endExecutionSpan(id: string, status?: ExecutionStatus, reason?: string | null): void {
    const span = this.executionSpans.get(id)
    this.executionSpans.delete(id)
    if (status !== undefined) {
      span?.setAttribute('botrts.status', status)
    }
    if (status === ExecutionStatus.KILLED) {
      span?.fail(reason ?? 'killed')
    }
    span?.end()
  }

  private async end(record: Execution, status: ExecutionStatus, reason: string | null): Promise<ExecutionView> {
    this.endExecutionSpan(record.id, status, reason)
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
