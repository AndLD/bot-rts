import { ErrorCode } from '../../../../lib/utils/error-codes'
import { ok } from '../../../../lib/utils/result'
import { SCRIPT_FUNCTIONS } from '../../../../lib/utils/script-api'
import { buildBase, buildModule } from '../../../tests/integration/builders'
import {
  FakeBotStateSource,
  FakeScriptSource,
  InMemoryExecutionRepository,
  RecordingSink
} from '../../../tests/fakes/engine'
import { FakeClock, SequentialIdGenerator } from '../../../tests/fakes/fakes'
import { createEngineWorld } from '../../../tests/fakes/world-engine'
import { createModuleRegistry } from '../../modules/domain/module-registry'
import { WorldStateStore } from '../../persistence/application/world-state-store'
import { SeededRng } from '../../shared/infrastructure/seeded-rng'
import { DEFAULT_ENGINE_CONFIG, EngineConfig } from '../domain/engine-config'
import { Execution, ExecutionStatus } from '../domain/execution'
import { SHELL_FILE } from '../domain/shell-script'
import { QuickJsScriptRuntime } from '../infrastructure/quickjs-script-runtime'
import { SucraseTranspiler } from '../infrastructure/sucrase-transpiler'
import { EngineCore } from './engine-core'
import { ModuleLoader } from './module-loader'
import { BotCapacities } from './bot-capacities'
import { FairScheduler } from './scheduler'
import { CallOutcome, ScriptApi, ScriptFunctionHandler } from './script-api'
import { EventOutbox } from './event-outbox'
import { BotPasswordWrongError } from '../../terminal/domain/terminal.errors'
import { GameEventBus } from './game-event-bus'
import { LiveVision } from './live-vision'
import { NoSignalError, RadioNetwork } from './radio-network'
import { WorldActionExecutor } from './world-action-executor'
import { WriteBehind } from './write-behind'

const OWNER = 'owner-1'
const FILE = '/memory/main.js'

class StubHandler implements ScriptFunctionHandler {
  readonly functions = SCRIPT_FUNCTIONS.filter((spec) => !spec.isScheduled).map((spec) => spec.name)
  readonly calls: Array<{ fn: string; args: unknown[] }> = []
  next: () => Promise<CallOutcome> = async () => ok({ cells: 3 })

  async handle(_bot: unknown, fn: string, args: readonly unknown[]) {
    this.calls.push({ fn, args: [...args] })
    return this.next()
  }
}

async function setup(options: { config?: Partial<EngineConfig>; monotonic?: () => number; withWatch?: boolean } = {}) {
  const runtime = await QuickJsScriptRuntime.create()
  const executions = new InMemoryExecutionRepository()
  const bots = new FakeBotStateSource()
  const sources = new FakeScriptSource()
  const sink = new RecordingSink()
  const handler = new StubHandler()
  const flushes: number[] = []
  const store: WorldStateStore = { flush: async () => void flushes.push(Date.now()) }
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const config = { ...DEFAULT_ENGINE_CONFIG, ...options.config }
  const base = buildBase(OWNER)
  const modules = ['processor', 'scanner', 'drive'].map((type) =>
    buildModule(base.id, {
      type: type as never,
      props: type === 'processor' ? { opsPerTick: 2, parallelExecutions: 1 } : {}
    })
  )
  bots.states.set(base.id, { bot: base, ownerId: OWNER, modules })
  sources.files.set(FILE, 'export async function main(bot) { bot.log("hello") }')

  const capacities = new BotCapacities()
  const outbox = new EventOutbox(new FakeClock())
  const bus = { deliver: jest.fn() }
  const radio = {
    refresh: jest.fn(async () => undefined),
    ensureControl: jest.fn(async () => undefined),
    statusOf: jest.fn(async () => ({ isConnected: true, signal: 4 as const, hops: 0 }))
  }
  const vision = { restore: jest.fn(async () => undefined), refresh: jest.fn(async () => undefined) }
  const actions = { execute: jest.fn(async (name: string, args: unknown[]): Promise<unknown> => ({ name, args })) }
  const writeBehind = new WriteBehind(store, config.flushEveryTicks, 3)
  const { world } = createEngineWorld({ states: bots.states, writeBehind })
  const policy = { isAllowed: jest.fn(async (_userId: string, _category: string) => true) }
  const watch = {
    calls: [] as string[],
    begin(id: string) {
      this.calls.push(`begin ${id}`)
    },
    end() {
      this.calls.push('end')
    }
  }
  const core = new EngineCore({
    config,
    watch: options.withWatch ? watch : undefined,
    worldSeed: 7,
    createRng: (seed) => new SeededRng(seed),
    executions,
    bots,
    modules: new ModuleLoader(sources, new SucraseTranspiler(), config.modules),
    runtime,
    api: new ScriptApi([handler]),
    scheduler: new FairScheduler(capacities, (seed) => new SeededRng(seed), 7),
    capacities,
    registry: createModuleRegistry(),
    writeBehind,
    world,
    vision: vision as unknown as LiveVision,
    radio: radio as unknown as RadioNetwork,
    outbox,
    bus: bus as unknown as GameEventBus,
    manualPolicy: policy,
    actions: actions as unknown as WorldActionExecutor,
    sink,
    ids: new SequentialIdGenerator(),
    clock: new FakeClock(),
    logger,
    monotonicMs: options.monotonic ?? (() => 0)
  })

  // Starts a script and runs the tick that serves the request
  const start = async (source: string, args: never[] = []) => {
    sources.files.set(FILE, source)
    const started = core.start({ userId: OWNER, botId: base.id, file: FILE, args })
    await core.runTick()
    return started
  }
  const ticks = async (count: number) => {
    for (let i = 0; i < count; i++) await core.runTick()
  }
  return {
    core,
    watch,
    executions,
    bots,
    sources,
    sink,
    handler,
    logger,
    flushes,
    base,
    modules,
    start,
    ticks,
    config,
    writeBehind,
    actions,
    world,
    vision,
    radio,
    outbox,
    bus,
    policy
  }
}

describe('EngineCore', () => {
  describe('running a script', () => {
    it('starts it, runs it and records that it finished', async () => {
      const { core, start, ticks, sink, executions } = await setup()

      const view = await start('export async function main(bot, a) { bot.log("hello", a, { x: 1 }) }', [2 as never])
      await ticks(1)

      expect(view).toMatchObject({ botId: expect.any(String), file: FILE, state: 'queued' })
      expect(sink.logs()).toEqual(['hello 2 {"x":1}'])
      expect([...executions.items.values()][0]).toMatchObject({ status: 'finished', reason: null })
      expect(await listNow(core)).toEqual([])
    })

    it('runs a TypeScript file that imports a library and a JSON file', async () => {
      const { core, base, sources, ticks, sink } = await setup()
      sources.files.set(
        '/memory/main.ts',
        "import { twice } from './lib'\nimport cfg from './cfg.json'\nexport async function main(bot: unknown, n: number): Promise<void> { (bot as any).log(twice(n), cfg.name) }"
      )
      sources.files.set('/memory/lib.ts', 'export const twice = (n: number): number => n * 2')
      sources.files.set('/memory/cfg.json', '{"name": "cfg"}')

      const started = core.start({ userId: OWNER, botId: base.id, file: '/memory/main.ts', args: [21] })
      await core.runTick()
      await started
      await ticks(1)

      expect(sink.logs()).toEqual(['42 cfg'])
    })

    it('refuses to start a script whose imports cannot be loaded, and records nothing', async () => {
      const { core, base, sources, executions } = await setup()
      sources.files.set('/memory/main.js', "import './missing'\nexport async function main() {}")

      const started = core.start({ userId: OWNER, botId: base.id, file: '/memory/main.js', args: [] })
      const assertion = expect(started).rejects.toMatchObject({ code: 'SCRIPT_LOAD_FAILED' })
      await core.runTick()
      await assertion

      expect(executions.items.size).toBe(0)
    })

    it('runs a line of the shell as a script of its own and shows the value it returns', async () => {
      const { core, base, ticks, sink } = await setup()

      const started = core.start({ userId: OWNER, botId: base.id, file: SHELL_FILE, args: ['bot.modules.length'] })
      await core.runTick()
      const view = await started
      await ticks(1)

      expect(view).toMatchObject({ file: SHELL_FILE, args: ['bot.modules.length'] })
      expect(sink.logs()).toEqual(['3'])
    })

    it('runs statements of the shell without showing a value', async () => {
      const { core, base, ticks, sink } = await setup()

      const started = core.start({ userId: OWNER, botId: base.id, file: SHELL_FILE, args: ['bot.log("hi")'] })
      await core.runTick()
      await started
      await ticks(1)

      expect(sink.logs()).toEqual(['hi'])
    })

    it('tells the step watch which execution is being stepped, and that the step is over', async () => {
      const { start, ticks, watch } = await setup({ withWatch: true })

      const view = await start('export async function main(bot) { bot.log("x") }')
      await ticks(1)

      expect(watch.calls.slice(0, 2)).toEqual([`begin ${view.id}`, 'end'])
    })

    it('ends the step in the watch even when the step throws', async () => {
      const { core, start, watch } = await setup({ withWatch: true })
      await start('export async function main(bot) { for (;;) await sleep(0) }')
      const live = [...(core as unknown as { live: Map<string, { step: () => never }> }).live.values()][0]
      live.step = () => {
        throw new Error('broken')
      }

      await expect(core.runTick()).rejects.toThrow('broken')

      expect(watch.calls[watch.calls.length - 1]).toBe('end')
    })

    it('cuts the log of a script that writes too much: lines per tick, and characters per line', async () => {
      const { start, ticks, sink } = await setup({ config: { log: { maxLinesPerTick: 3, maxChars: 10 } } })

      await start(
        'export async function main(bot) { for (let i = 0; i < 100; i++) bot.log("line " + i); bot.log("x".repeat(500)) }'
      )
      await ticks(1)

      expect(sink.logs()).toEqual(['line 0', 'line 1', 'line 2', 'output cut: more than 3 lines in one tick'])
    })

    it('lets the script write again in the next tick', async () => {
      const { start, ticks, sink } = await setup({ config: { log: { maxLinesPerTick: 1, maxChars: 8 } } })

      await start(
        'export async function main(bot) { bot.log("a".repeat(30)); await sleep(1); bot.log("second"); bot.log("dropped") }'
      )
      await ticks(3)

      expect(sink.logs().filter((line) => !line.startsWith('output cut'))).toEqual(['aaaaaaaa… (cut)', 'second'])
    })

    it('applies a game call in the tick it was made and resolves it in the next one', async () => {
      const { start, ticks, sink, handler } = await setup()

      await start('export async function main(bot) { const r = await bot.scan(); bot.log(r.ok, r.data.cells) }')
      expect(handler.calls).toEqual([{ fn: 'scan', args: [] }])
      expect(sink.logs()).toEqual([])

      await ticks(1)
      expect(sink.logs()).toEqual(['true 3'])
    })

    it('drops the calls a script made in the tick it finished', async () => {
      const { start, ticks, handler, executions } = await setup()

      await start('export async function main(bot) { bot.scan() }')
      await ticks(1)

      expect(handler.calls).toEqual([])
      expect([...executions.items.values()][0].status).toBe('finished')
    })

    it('answers a call without data with a bare success value', async () => {
      const { start, ticks, sink, handler } = await setup()
      handler.next = async () => ok(undefined)

      await start('export async function main(bot) { const r = await bot.scan(); bot.log(r) }')
      await ticks(1)

      expect(sink.logs()).toEqual(['{"ok":true}'])
    })

    it('answers a failed call with a failure value the script can branch on', async () => {
      const { start, ticks, sink, handler } = await setup()
      handler.next = async () => ({ ok: false, code: 'COOLDOWN', msg: 'wait' })

      await start('export async function main(bot) { const r = await bot.scan(); bot.log(r.ok, r.code) }')
      await ticks(1)

      expect(sink.logs()).toEqual(['false COOLDOWN'])
    })

    it('suspends a script on sleep for the ticks the time takes', async () => {
      const { core, start, ticks, sink } = await setup()

      await start('export async function main(bot) { bot.log("a"); await sleep(250); bot.log("b") }')
      await ticks(1)
      expect(sink.logs()).toEqual(['a'])
      expect((await listNow(core))[0].state).toBe('suspended')

      await ticks(3)
      expect(sink.logs()).toEqual(['a', 'b'])
    })

    it('lets sleep(0) yield for one tick and refuses invalid sleeps', async () => {
      const { start, ticks, sink } = await setup()

      await start(
        'export async function main(bot) { await sleep(0); bot.log("yielded"); try { await sleep(-1) } catch (e) { bot.log(e.message) } try { await sleep("x") } catch (e) { bot.log(e.message) } }'
      )
      await ticks(3)

      expect(sink.logs()).toEqual(['yielded', 'sleep: ms must not be negative', 'sleep: ms must be an integer'])
    })

    it('shows a script waiting for an answer as awaiting', async () => {
      const { core, start } = await setup()

      await start('export async function main(bot) { await bot.scan() }')

      expect((await listNow(core))[0].state).toBe('awaiting')
    })

    it('lists the modules of the bot on the bot object, so that a script can name one', async () => {
      const { start, ticks, sink, modules } = await setup()

      await start('export async function main(bot) { bot.log(bot.modules.map((m) => m.type).join(",")) }')
      await ticks(1)

      expect(sink.logs()).toEqual([modules.map((module) => module.type).join(',')])
    })

    it('gives each execution its own seeded random numbers and the game time', async () => {
      const first = await setup()
      const second = await setup()
      const source = 'export async function main(bot) { bot.log(Math.random(), bot.time()) }'

      await first.start(source)
      await first.ticks(1)
      await second.start(source)
      await second.ticks(1)

      expect(first.sink.logs()).toEqual(second.sink.logs())
      expect(first.sink.logs()[0]).toMatch(/^0\.\d+ 100$/)
    })
  })

  describe('failures', () => {
    it('kills a script that throws and tells its log', async () => {
      const { start, ticks, sink, executions } = await setup()

      await start('export async function main() { throw new Error("boom") }')
      await ticks(1)

      expect([...executions.items.values()][0]).toMatchObject({
        status: 'killed',
        reason: 'SCRIPT_ERROR: Error: boom'
      })
      expect(sink.logs()).toEqual(['SCRIPT_ERROR: Error: boom'])
      expect(sink.events.filter((event) => event.type === 'log')[0]).toMatchObject({ kind: 'error' })
    })

    it('kills a script that runs past its slice', async () => {
      const { start, ticks, executions } = await setup()

      await start('export async function main() { for (;;) {} }')
      await ticks(1)

      expect([...executions.items.values()][0].reason).toMatch(/^TIME_LIMIT/)
    })

    it('kills a script that calls a function its bot has no module for', async () => {
      const { start, ticks, executions } = await setup()

      await start('export async function main(bot) { await bot.craft("x") }')
      await ticks(2)

      expect([...executions.items.values()][0].reason).toMatch(/not a function/)
    })

    it('kills a script whose call is misuse', async () => {
      const { start, ticks, executions } = await setup()
      await start('export async function main(bot) { await bot.scan(1) }')
      await ticks(2)

      expect([...executions.items.values()][0].reason).toMatch(/takes at most 0 arguments/)
    })

    it('hides an unexpected error of a handler behind "Internal error" and logs it', async () => {
      const { start, ticks, executions, handler, logger } = await setup()
      handler.next = async () => {
        throw new TypeError('bug')
      }

      await start('export async function main(bot) { await bot.scan() }')
      await ticks(2)

      expect([...executions.items.values()][0].reason).toMatch(/Internal error/)
      expect(logger.error).toHaveBeenCalledWith(expect.any(TypeError))
    })

    it('answers a call of a bot that is gone with a failure value', async () => {
      const { start, ticks, sink, bots, base } = await setup()

      // The bot disappears right after the engine has let the script start
      const state = bots.states.get(base.id)!
      jest.spyOn(bots, 'loadControlled').mockImplementationOnce(async () => {
        bots.states.delete(base.id)
        return state
      })
      await start('export async function main(bot) { const r = await bot.scan(); bot.log(r.code) }')
      await ticks(1)

      expect(sink.logs()).toEqual(['NOT_FOUND'])
    })

    it('refuses to start without a working processor, a readable file or control of the bot', async () => {
      const { core, bots, base, sources, ticks } = await setup()
      const state = bots.states.get(base.id)!

      bots.states.set(base.id, {
        ...state,
        modules: state.modules.map((module) => (module.type === 'processor' ? { ...module, condition: 0 } : module))
      })
      const broken = core.start({ userId: OWNER, botId: base.id, file: FILE, args: [] })
      broken.catch(() => undefined)
      await ticks(1)
      await expect(broken).rejects.toMatchObject({ code: 'NO_MODULE' })

      bots.states.set(base.id, state)
      sources.files.delete(FILE)
      const missing = core.start({ userId: OWNER, botId: base.id, file: FILE, args: [] })
      missing.catch(() => undefined)
      await ticks(1)
      await expect(missing).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND })

      const stranger = core.start({ userId: 'someone', botId: base.id, file: FILE, args: [] })
      stranger.catch(() => undefined)
      await ticks(1)
      await expect(stranger).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND })
    })

    it('does not keep a sandbox when the record cannot be stored', async () => {
      const { core, executions, base, ticks } = await setup()
      executions.add = async () => {
        throw new Error('db down')
      }

      const started = core.start({ userId: OWNER, botId: base.id, file: FILE, args: [] })
      started.catch(() => undefined)
      await ticks(1)

      await expect(started).rejects.toThrow('db down')
    })
  })

  describe('actions of the API', () => {
    it('runs a use case between ticks with the memory written first and forgotten afterwards', async () => {
      const { core, actions, world, flushes } = await setup()
      const order: string[] = []
      jest.spyOn(world, 'sync').mockImplementation(async () => void order.push('sync'))
      jest.spyOn(world, 'evict').mockImplementation(() => void order.push('evict'))
      actions.execute.mockImplementationOnce(async () => {
        order.push('run')
        return 'done'
      })

      const result = core.act('files.write', ['u', 'b'])
      expect(order).toEqual([])
      await core.runTick()

      await expect(result).resolves.toBe('done')
      expect(order).toEqual(['sync', 'run', 'evict'])
      expect(actions.execute).toHaveBeenCalledWith('files.write', ['u', 'b'])
      expect(flushes).toEqual([])
    })

    it('stops what a bot was running when someone else adopts it, and leaves other bots alone', async () => {
      const { core, base, start, ticks, executions, actions, sink } = await setup()
      await start('export async function main(bot) { await sleep(100000) }')
      expect(await listNow(core)).toHaveLength(1)

      const unrelated = core.act('access.adopt', ['thief', 'thief-base', 'someone-else'])
      await ticks(1)
      await unrelated
      expect(await listNow(core)).toHaveLength(1)

      const adoption = core.act('access.adopt', ['thief', 'thief-base', base.id])
      await ticks(1)
      await adoption

      expect(actions.execute).toHaveBeenCalledWith('access.adopt', ['thief', 'thief-base', base.id])
      expect(await listNow(core)).toEqual([])
      expect([...executions.items.values()][0]).toMatchObject({ status: 'killed', reason: 'killed' })
      expect(sink.events.some((event) => event.type === 'execution')).toBe(true)
    })

    it('forgets the memory and passes on the error when the use case fails', async () => {
      const { core, actions, world } = await setup()
      const evict = jest.spyOn(world, 'evict')
      actions.execute.mockRejectedValueOnce(new Error('refused'))

      const result = core.act('factory.craft', [])
      result.catch(() => undefined)
      await core.runTick()

      await expect(result).rejects.toThrow('refused')
      expect(evict).toHaveBeenCalled()
    })
  })

  describe('kill and list', () => {
    it('kills an execution of the player', async () => {
      const { core, start, ticks, executions, sink } = await setup()
      const view = await start('export async function main(bot) { await sleep(100000) }')
      await ticks(1)

      const killed = core.kill(OWNER, view.id)
      await ticks(1)

      await expect(killed).resolves.toMatchObject({ state: 'killed', reason: 'killed' })
      expect(executions.items.get(view.id)).toMatchObject({ status: 'killed', reason: 'killed' })
      expect(sink.events[sink.events.length - 1]).toMatchObject({ type: 'execution', execution: { state: 'killed' } })
      expect(await listNow(core)).toEqual([])
    })

    it("refuses to kill another player's or an unknown execution", async () => {
      const { core, start, ticks } = await setup()
      const view = await start('export async function main(bot) { await sleep(100000) }')

      const foreign = core.kill('someone', view.id)
      foreign.catch(() => undefined)
      const unknown = core.kill(OWNER, 'nope')
      unknown.catch(() => undefined)
      await ticks(1)

      await expect(foreign).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN })
      await expect(unknown).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND })
    })

    it('lists only the executions of the player', async () => {
      const { core, start, ticks } = await setup()
      await start('export async function main(bot) { await sleep(100000) }')
      await ticks(1)

      expect(await listNow(core)).toHaveLength(1)
      const others = core.list('someone')
      await ticks(1)
      await expect(others).resolves.toEqual([])
    })
  })

  describe('restart recovery', () => {
    const active = (id: string, botId: string, restarts = 0): Execution => ({
      id,
      botId,
      userId: OWNER,
      file: FILE,
      args: [],
      status: ExecutionStatus.ACTIVE,
      restarts,
      reason: null,
      createdAt: new Date(0),
      endedAt: null
    })

    it('relaunches active executions from main with a rebooted note', async () => {
      const { core, executions, base, sink, ticks, sources } = await setup()
      sources.files.set(FILE, 'export async function main(bot) { bot.log("again"); await sleep(100000) }')
      await executions.add(active('e1', base.id, 1))

      await core.recover()
      await ticks(1)

      expect(executions.items.get('e1')).toMatchObject({ status: 'active', restarts: 2 })
      expect(sink.logs('e1')).toEqual([expect.stringMatching(/^rebooted/), 'again'])
    })

    it('kills an execution that keeps dying with the engine', async () => {
      const { core, executions, base } = await setup()
      await executions.add(active('e1', base.id, 3))

      await core.recover()

      expect(executions.items.get('e1')).toMatchObject({
        status: 'killed',
        reason: expect.stringMatching(/^crash-loop/)
      })
    })

    it('kills an execution whose bot or file is gone', async () => {
      const { core, executions, base, sources } = await setup()
      await executions.add(active('e1', base.id))
      await executions.add(active('e2', 'missing-bot'))
      sources.files.delete(FILE)

      await core.recover()
      expect(executions.items.get('e1')).toMatchObject({ status: 'killed', reason: 'File not found' })
      expect(executions.items.get('e2')).toMatchObject({ status: 'killed', reason: 'The bot is gone' })
    })

    it('forgets the restarts of an execution that ran healthy, and on a deliberate shutdown', async () => {
      const { core, executions, base, ticks, sources } = await setup({ config: { healthyTicks: 2 } })
      sources.files.set(FILE, 'export async function main(bot) { await sleep(100000) }')
      await executions.add(active('e1', base.id, 2))
      await core.recover()

      await ticks(3)
      expect(executions.items.get('e1')?.restarts).toBe(0)

      await executions.update(active('e1', base.id, 2))
      await core.shutdown()
      expect(executions.items.get('e1')?.restarts).toBe(0)
      expect(await listNow(core)).toEqual([])
    })
  })

  describe('the fair scheduler', () => {
    it('lets a bot make only as many calls per tick as its processor allows', async () => {
      const { start, ticks, handler, sink } = await setup()

      await start(
        'export async function main(bot) { const r = await Promise.all([bot.scan(), bot.scan(), bot.scan()]); bot.log(r.length) }'
      )
      expect(handler.calls).toHaveLength(2)
      await ticks(1)
      expect(handler.calls).toHaveLength(3)
      expect(sink.logs()).toEqual([])
      await ticks(1)
      expect(sink.logs()).toEqual(['3'])
    })

    it('never lets calls through for a bot whose processor allows no ops', async () => {
      const { start, ticks, handler, bots, base } = await setup()
      const state = bots.states.get(base.id)!
      bots.states.set(base.id, {
        ...state,
        modules: state.modules.map((m) =>
          m.type === 'processor' ? { ...m, props: { opsPerTick: 0, parallelExecutions: 1 } } : m
        )
      })

      await start('export async function main(bot) { await bot.scan() }')
      await ticks(3)

      expect(handler.calls).toEqual([])
    })

    it('keeps a second execution of a bot queued until the first has ended', async () => {
      const { core, base, start, ticks, sink } = await setup()
      await start('export async function main(bot) { bot.log("one"); await sleep(250) }')
      const second = core.start({ userId: OWNER, botId: base.id, file: FILE, args: [] })
      second.catch(() => undefined)

      await ticks(1)
      expect(sink.logs()).toEqual(['one'])
      expect((await listNow(core)).map((e) => e.state)).toEqual(['suspended', 'queued'])
      expect(core.snapshot()).toMatchObject({ queuedExecutions: 1, deferredExecutions: 0, maxWaitTicks: 0 })
      await ticks(8)
      expect(sink.logs()).toEqual(['one', 'one'])
    })

    it('keeps the calls the tick had no time to apply for the next tick', async () => {
      const script = [0, 0, 500, 500]
      let last = 500
      const { start, ticks, handler, core } = await setup({
        monotonic: () => script.shift() ?? (last += 0.001)
      })

      await start('export async function main(bot) { await bot.scan() }')
      expect(handler.calls).toEqual([])
      expect(core.snapshot().cutTicks).toBe(1)

      await ticks(1)
      expect(handler.calls).toHaveLength(1)
    })

    it('serves every player alike when the tick cap keeps it from serving all of them', async () => {
      let now = 0
      const { core, bots, sources, sink, ticks } = await setup({
        config: { tickIntervalMs: 10, tickCapRatio: 0.5 },
        monotonic: () => (now += 1)
      })
      const players = Array.from({ length: 8 }, (_, i) => `player-${i}`)
      sources.files.set(FILE, 'export async function main(bot) { for (;;) { bot.log("x"); await sleep(0) } }')
      const started = []
      for (const player of players) {
        const base = buildBase(player)
        bots.states.set(base.id, {
          bot: base,
          ownerId: player,
          modules: [buildModule(base.id, { type: 'processor', props: { opsPerTick: 2, parallelExecutions: 1 } })]
        })
        started.push(core.start({ userId: player, botId: base.id, file: FILE, args: [] }))
      }
      await ticks(60)
      const views = await Promise.all(started)

      const steps = views.map((view) => sink.logs(view.id).length)
      expect(core.snapshot().cutTicks).toBeGreaterThan(0)
      expect(Math.min(...steps)).toBeGreaterThan(5)
      expect(Math.max(...steps) - Math.min(...steps)).toBeLessThanOrEqual(2)
      // Someone is always left out, but nobody waits for long: the longest wait stays below a round of the players
      const { maxWaitTicks, deferredExecutions } = core.snapshot()
      expect(deferredExecutions).toBeGreaterThan(0)
      expect(maxWaitTicks).toBeGreaterThan(0)
      expect(maxWaitTicks).toBeLessThanOrEqual(players.length)
    })
  })

  describe('game events', () => {
    it('publishes that a script finished or failed, and hands the events out after the commands of every tick', async () => {
      const { start, ticks, outbox, bus, base } = await setup()

      await start('export async function main() {}')
      await ticks(1)
      await start('export async function main() { throw new Error("boom") }')
      await ticks(1)

      const events = outbox.drain()
      expect(events.map((e) => e.type)).toEqual(['ExecutionFinished', 'ExecutionFailed'])
      expect(events[0]).toMatchObject({ parties: [{ userId: OWNER, botId: base.id }], executionId: expect.any(String) })
      expect(events[1]).toMatchObject({ reason: 'SCRIPT_ERROR: Error: boom' })
      expect(bus.deliver).toHaveBeenCalledTimes(4)
    })

    it('publishes a kill as a failed execution', async () => {
      const { core, start, ticks, outbox } = await setup()
      const view = await start('export async function main(bot) { await sleep(100000) }')

      const killed = core.kill(OWNER, view.id)
      await ticks(1)
      await killed

      expect(outbox.drain()).toEqual([expect.objectContaining({ type: 'ExecutionFailed', reason: 'killed' })])
    })

    it('tells a bot about its energy: running low, out of fuel, a live scan that stopped', async () => {
      const { ticks, outbox, world, base, modules } = await setup()
      const botState = { bot: base, ownerId: OWNER, modules }
      const worldBot = { state: botState, position: null, heading: 0 as const, carried: [] }
      jest.spyOn(world, 'tickEnergy').mockReturnValue([
        { bot: worldBot, event: { type: 'EnergyLow' } },
        { bot: worldBot, event: { type: 'OutOfFuel', moduleId: 'gen' } },
        { bot: worldBot, event: { type: 'LiveScanStopped', moduleId: 'scan' } }
      ])

      await ticks(1)

      expect(outbox.drain().map((e) => e.type)).toEqual(['EnergyLow', 'OutOfFuel', 'LiveScanStopped'])
    })
  })

  describe('manual actions', () => {
    const flushPromises = () => new Promise((resolve) => setImmediate(resolve))
    const settled = (promise: Promise<unknown>) => {
      const outcome: { value?: unknown; error?: unknown; done: boolean } = { done: false }
      promise.then(
        (value) => Object.assign(outcome, { value, done: true }),
        (error) => Object.assign(outcome, { error, done: true })
      )
      return outcome
    }

    it('answers like a script call, in the tick it is applied', async () => {
      const { core, handler, radio, base } = await setup()

      const answer = settled(core.manual(OWNER, base.id, 'scan', []))
      await core.runTick()
      await flushPromises()

      expect(answer).toMatchObject({ done: true, value: { ok: true, data: { cells: 3 } } })
      expect(handler.calls).toEqual([{ fn: 'scan', args: [] }])
      expect(radio.ensureControl).toHaveBeenCalledWith(OWNER, base.id)
    })

    it('lets a bot do one action at a time, like a script that waits for each answer', async () => {
      const { core, ticks, handler, base } = await setup()

      const answers = [1, 2, 3].map(() => settled(core.manual(OWNER, base.id, 'scan', [])))
      await core.runTick()
      await flushPromises()
      expect(answers.map((a) => a.done)).toEqual([true, false, false])

      await ticks(1)
      await flushPromises()
      expect(answers.map((a) => a.done)).toEqual([true, true, false])
      expect(handler.calls).toHaveLength(2)

      await ticks(1)
      await flushPromises()
      expect(answers[2].done).toBe(true)
    })

    it('keeps the bot busy for as long as the action takes', async () => {
      const { core, ticks, handler, base } = await setup()
      handler.next = async () => ({ ...ok({ cells: 3 }), delayTicks: 2 })

      const first = settled(core.manual(OWNER, base.id, 'scan', []))
      const second = settled(core.manual(OWNER, base.id, 'scan', []))
      await core.runTick()
      await flushPromises()
      expect([first.done, second.done]).toEqual([true, false])

      await ticks(2)
      await flushPromises()
      expect(second.done).toBe(false)

      await ticks(1)
      await flushPromises()
      expect(second.done).toBe(true)
    })

    it('hands a failure of the action to the player as a value', async () => {
      const { core, handler, base } = await setup()
      handler.next = async () => ({ ok: false, code: 'BLOCKED', msg: 'The cell is occupied' }) as CallOutcome

      const answer = settled(core.manual(OWNER, base.id, 'scan', []))
      await core.runTick()
      await flushPromises()

      expect(answer.value).toEqual({ ok: false, code: 'BLOCKED', msg: 'The cell is occupied' })
    })

    it('refuses an action of a category that is switched off, before anything else, and lets observation through', async () => {
      const { core, policy, handler, radio, base } = await setup()
      policy.isAllowed.mockImplementation(async (_user, category) => category !== 'movement')

      const refused = settled(core.manual(OWNER, base.id, 'move', [1]))
      const observed = settled(core.manual(OWNER, base.id, 'scan', []))
      await core.runTick()
      await flushPromises()

      expect(refused.error).toMatchObject({ statusCode: 403, code: 'MANUAL_CATEGORY_DISABLED' })
      expect(observed.value).toMatchObject({ ok: true })
      expect(policy.isAllowed).toHaveBeenCalledWith(OWNER, 'movement')
      expect(policy.isAllowed).toHaveBeenCalledTimes(1)
      expect(handler.calls).toEqual([{ fn: 'scan', args: [] }])
      expect(radio.ensureControl).toHaveBeenCalledTimes(1)
    })

    it('refuses what is not a manual action, and actions the bot has no module for', async () => {
      const { core, base } = await setup()

      const unknown = settled(core.manual(OWNER, base.id, 'fly', []))
      const scheduled = settled(core.manual(OWNER, base.id, 'sleep', [10]))
      const noModule = settled(core.manual(OWNER, base.id, 'move', [1]))
      await core.runTick()
      await core.runTick()
      await flushPromises()

      expect(unknown.error).toMatchObject({ statusCode: 400 })
      expect(scheduled.error).toMatchObject({ statusCode: 400 })
      expect(noModule.error).toMatchObject({ statusCode: 400 })
    })

    it('refuses a bot without a working processor, a bot out of reach and a bot of someone else', async () => {
      const { core, radio, bots, base } = await setup()
      const state = bots.states.get(base.id)!

      radio.ensureControl.mockRejectedValueOnce(new NoSignalError())
      const outOfReach = settled(core.manual(OWNER, base.id, 'scan', []))
      const stranger = settled(core.manual('someone-else', base.id, 'scan', []))
      bots.states.set(base.id, { ...state, modules: state.modules.filter((m) => m.type !== 'processor') })
      const noProcessor = settled(core.manual(OWNER, base.id, 'scan', []))
      await core.runTick()
      await flushPromises()

      expect(outOfReach.error).toMatchObject({ code: 'NO_SIGNAL' })
      expect(stranger.error).toBeDefined()
      expect(noProcessor.error).toMatchObject({ statusCode: 409, code: 'NO_MODULE' })
    })
  })

  describe('the radio link', () => {
    it('refuses manual control of a bot out of reach before running the use case', async () => {
      const { core, radio, actions } = await setup()
      radio.ensureControl.mockRejectedValueOnce(new NoSignalError())

      const result = core.act('factory.craft', ['user-1', 'bot-9', 'scanner-class1'])
      result.catch(() => undefined)
      await core.runTick()

      await expect(result).rejects.toMatchObject({ statusCode: 409, code: 'NO_SIGNAL' })
      expect(radio.ensureControl).toHaveBeenCalledWith('user-1', 'bot-9')
      expect(actions.execute).not.toHaveBeenCalled()
    })

    it('refuses a use case of a category that is switched off before it runs, and runs the others', async () => {
      const { core, policy, actions, radio } = await setup()
      policy.isAllowed.mockImplementation(async (_user, category) => category !== 'fabrication')

      const crafted = core.act('factory.craft', ['user-1', 'bot-1', 'scanner-class1'])
      crafted.catch(() => undefined)
      const repaired = core.act('maintenance.repair', ['user-1', { repairerId: 'bot-1' }])
      await core.runTick()

      await expect(crafted).rejects.toMatchObject({ statusCode: 403, code: 'MANUAL_CATEGORY_DISABLED' })
      await repaired
      expect(actions.execute).toHaveBeenCalledTimes(1)
      expect(actions.execute).toHaveBeenCalledWith('maintenance.repair', expect.anything())
      expect(radio.ensureControl).toHaveBeenCalledTimes(1)
      expect(policy.isAllowed).toHaveBeenCalledWith('user-1', 'fabrication')
    })

    it('does not ask for a link when the action controls no bot', async () => {
      const { core, radio, actions } = await setup()
      actions.execute.mockResolvedValueOnce({ bot: { id: 'base-1' } })

      const result = core.act('bots.deployUserBase', [{ id: 'u', name: 'U' }, { password: 'x' }])
      await core.runTick()
      await result

      expect(radio.ensureControl).not.toHaveBeenCalled()
      expect(actions.execute).toHaveBeenCalled()
    })

    it('publishes what a world action did as an event, and nothing for an action without one or one that failed', async () => {
      const { core, actions, outbox } = await setup()
      actions.execute.mockResolvedValueOnce({ bot: { id: 'base-1' } })

      const deploy = core.act('bots.deployUserBase', [{ id: 'u', name: 'U' }, { password: 'x' }])
      await core.runTick()
      await deploy
      const files = core.act('files.remove', ['user-1', 'bot-1', 'a.js'])
      await core.runTick()
      await files
      actions.execute.mockRejectedValueOnce(new Error('no'))
      const failing = core.act('factory.craft', ['user-1', 'bot-1', 'scanner-class1', 1]).catch(() => undefined)
      await core.runTick()
      await failing

      expect(outbox.drain()).toEqual([
        expect.objectContaining({ type: 'BaseDeployed', parties: [{ userId: 'u', botId: 'base-1' }] })
      ])
    })

    it('tells the owner of a bot that someone tried a wrong password on it, and lets the one who tried get the error', async () => {
      const { core, actions, outbox } = await setup()
      actions.execute.mockRejectedValueOnce(
        new BotPasswordWrongError({ targetBotId: 'target-1', ownerId: 'owner-1', isLockedOut: true })
      )

      const attempt = core.act('access.connect', ['user-1', 'bot-1', 'target-1', 'guess']).catch((error) => error)
      await core.runTick()

      expect(await attempt).toBeInstanceOf(BotPasswordWrongError)
      expect(outbox.drain()).toEqual([
        {
          type: 'PasswordAttemptFailed',
          at: expect.any(Number),
          parties: [
            { userId: 'owner-1', botId: 'target-1' },
            { userId: 'user-1', botId: 'bot-1' }
          ],
          isLockedOut: true
        }
      ])
    })

    it('tells nobody of a wrong password on a bot nobody owns, or of any other failure', async () => {
      const { core, actions, outbox } = await setup()
      actions.execute.mockRejectedValueOnce(
        new BotPasswordWrongError({ targetBotId: 'target-1', ownerId: null, isLockedOut: false })
      )
      actions.execute.mockRejectedValueOnce(new BotPasswordWrongError())

      const unowned = core.act('access.connect', ['user-1', 'bot-1', 'target-1']).catch(() => undefined)
      const bare = core.act('access.connect', ['user-1', 'bot-1', 'target-1']).catch(() => undefined)
      await core.runTick()
      await Promise.all([unowned, bare])

      expect(outbox.drain()).toEqual([])
    })

    it('tells the link status of a bot, and recomputes the networks that changed every tick', async () => {
      const { core, radio, ticks } = await setup()

      const status = core.link('user-1', 'bot-1')
      await ticks(1)

      await expect(status).resolves.toEqual({ isConnected: true, signal: 4, hops: 0 })
      expect(radio.statusOf).toHaveBeenCalledWith('user-1', 'bot-1')
      expect(radio.refresh).toHaveBeenCalledTimes(1)
    })
  })

  describe('live vision', () => {
    it('brings the live views up to date every tick and resumes them after a restart', async () => {
      const { core, vision, ticks } = await setup()

      await core.recover()
      await ticks(2)

      expect(vision.restore).toHaveBeenCalledTimes(1)
      expect(vision.refresh).toHaveBeenCalledTimes(2)
      expect(vision.refresh).toHaveBeenLastCalledWith(2, expect.any(Number))
    })
  })

  describe('the tick', () => {
    it('stops running executions at the tick cap and records the cut', async () => {
      let now = 0
      const { core, start, ticks, sink } = await setup({ monotonic: () => (now += 100) })
      await start('export async function main(bot) { bot.log("a") }')
      await ticks(1)

      const snapshot = core.snapshot()
      expect(snapshot.cutTicks).toBeGreaterThan(0)
      expect(snapshot.overrunTicks).toBeGreaterThan(0)
      expect(sink.logs()).toEqual([])
    })

    it('exports the tick duration and the memory of the sandboxes', async () => {
      const { core, start, ticks } = await setup()
      await start('export async function main(bot) { await sleep(100000) }')
      await ticks(2)

      expect(core.snapshot()).toMatchObject({ tick: 3, executions: 1, overrunTicks: 0, cutTicks: 0 })
      expect(core.snapshot().memoryBytes).toBeGreaterThan(0)
      expect(core.tick).toBe(3)
    })

    it('writes the world behind every configured number of ticks', async () => {
      const { ticks, flushes, writeBehind } = await setup({ config: { flushEveryTicks: 2 } })
      writeBehind.stageMapPoint({
        id: 'p',
        location: { x: 0, y: 0, z: 0 },
        type: null,
        contentId: null,
        resource: null
      })

      await ticks(1)
      expect(flushes).toHaveLength(0)
      await ticks(1)
      expect(flushes).toHaveLength(1)
    })
  })
})

async function listNow(core: EngineCore) {
  const list = core.list(OWNER)
  await core.runTick()
  return list
}
