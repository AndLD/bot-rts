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
import { createModuleRegistry } from '../../modules/domain/module-registry'
import { WorldStateStore } from '../../persistence/application/world-state-store'
import { SeededRng } from '../../shared/infrastructure/seeded-rng'
import { DEFAULT_ENGINE_CONFIG, EngineConfig } from '../domain/engine-config'
import { Execution, ExecutionStatus } from '../domain/execution'
import { QuickJsScriptRuntime } from '../infrastructure/quickjs-script-runtime'
import { EngineCore } from './engine-core'
import { ArrivalOrderScheduler } from './scheduler'
import { CallOutcome, ScriptApi, ScriptFunctionHandler } from './script-api'
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

async function setup(options: { config?: Partial<EngineConfig>; monotonic?: () => number } = {}) {
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
  const modules = ['processor', 'scanner', 'drive'].map((type) => buildModule(base.id, { type: type as never }))
  bots.states.set(base.id, { bot: base, ownerId: OWNER, modules })
  sources.files.set(FILE, 'export async function main(bot) { bot.log("hello") }')

  const writeBehind = new WriteBehind(store, config.flushEveryTicks)
  const core = new EngineCore({
    config,
    worldSeed: 7,
    createRng: (seed) => new SeededRng(seed),
    executions,
    bots,
    sources,
    runtime,
    api: new ScriptApi([handler]),
    scheduler: new ArrivalOrderScheduler(),
    registry: createModuleRegistry(),
    writeBehind,
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
    writeBehind
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
      const { start, ticks, sink, bots } = await setup()

      jest.spyOn(bots, 'load').mockResolvedValueOnce(null)
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
