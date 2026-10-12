import { ok } from '../../../../lib/utils/result'
import { SCRIPT_FUNCTIONS } from '../../../../lib/utils/script-api'
import {
  FakeBotStateSource,
  FakeScriptSource,
  InMemoryExecutionRepository,
  RecordingSink
} from '../../../tests/fakes/engine'
import { FakeClock, SequentialIdGenerator } from '../../../tests/fakes/fakes'
import { createEngineWorld, FULL_KIT } from '../../../tests/fakes/world-engine'
import { createModuleRegistry } from '../../modules/domain/module-registry'
import { SeededRng } from '../../shared/infrastructure/seeded-rng'
import { DEFAULT_ENGINE_CONFIG } from '../domain/engine-config'
import { QuickJsScriptRuntime } from '../infrastructure/quickjs-script-runtime'
import { SucraseTranspiler } from '../infrastructure/sucrase-transpiler'
import { BotCapacities } from './bot-capacities'
import { EngineCore } from './engine-core'
import { EventOutbox } from './event-outbox'
import { GameEventBus } from './game-event-bus'
import { LiveVision } from './live-vision'
import { ModuleLoader } from './module-loader'
import { RadioNetwork } from './radio-network'
import { FairScheduler } from './scheduler'
import { ScriptApi } from './script-api'
import { WorldActionExecutor } from './world-action-executor'
import { WriteBehind } from './write-behind'

// Many players at once, on the real clock (plan task 5.7): the tick stays within its budget and nobody is starved, including
// when some players run scripts that never stop.
const HONEST =
  'export async function main(bot) { for (let n = 1; ; n++) { let x = 0; for (let i = 0; i < 2000; i++) x += i; bot.log(n); await bot.sleep(1) } }'
const HOG = 'export async function main() { for (;;) {} }'

// The time the scheduler gives a tick is read from a virtual clock that advances a fixed step per reading, so which bots run in
// a tick, and therefore the fairness this test checks, is the same on every machine. The durations of the ticks are measured
// on the real clock.
const VIRTUAL_MS_PER_CHECK = 1

async function stage(players: Array<{ id: string; script: string }>, ticks: number, config = DEFAULT_ENGINE_CONFIG) {
  let virtualMs = 0
  const runtime = await QuickJsScriptRuntime.create()
  const states = new FakeBotStateSource()
  const engine = createEngineWorld({ seed: 11, states: states.states })
  const sources = new FakeScriptSource()
  const sink = new RecordingSink()
  const capacities = new BotCapacities()
  const outbox = new EventOutbox(new FakeClock())
  const names = SCRIPT_FUNCTIONS.filter((spec) => !spec.isScheduled).map((spec) => spec.name)
  const core = new EngineCore({
    config,
    worldSeed: 11,
    createRng: (seed) => new SeededRng(seed),
    executions: new InMemoryExecutionRepository(),
    bots: states,
    modules: new ModuleLoader(sources, new SucraseTranspiler(), config.modules),
    runtime,
    api: new ScriptApi([{ functions: names, handle: async () => ok(undefined) }]),
    scheduler: new FairScheduler(capacities, (seed) => new SeededRng(seed), 11),
    capacities,
    registry: createModuleRegistry(),
    writeBehind: new WriteBehind({ flush: async () => undefined }, 10, 3),
    world: engine.world,
    vision: { restore: jest.fn(), refresh: jest.fn() } as unknown as LiveVision,
    radio: { refresh: jest.fn() } as unknown as RadioNetwork,
    outbox,
    bus: { deliver: jest.fn() } as unknown as GameEventBus,
    actions: { execute: jest.fn() } as unknown as WorldActionExecutor,
    sink,
    ids: new SequentialIdGenerator(),
    clock: new FakeClock(),
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    monotonicMs: () => (virtualMs += VIRTUAL_MS_PER_CHECK)
  })

  const started = []
  for (const [index, player] of players.entries()) {
    engine.addBot(player.id, { x: 5 + (index % 100), y: 5 + Math.floor(index / 100), z: 0 }, FULL_KIT, {
      ownerId: `owner-${player.id}`
    })
    states.states.set(player.id, engine.source.bots.get(player.id)!.state)
    sources.files.set(`/m/${player.id}.js`, player.script)
    started.push(core.start({ userId: `owner-${player.id}`, botId: player.id, file: `/m/${player.id}.js`, args: [] }))
  }
  const durations: number[] = []
  for (let i = 0; i < ticks; i++) {
    const startedAt = performance.now()
    await core.runTick()
    durations.push(performance.now() - startedAt)
  }
  const views = await Promise.all(started)
  const progress = new Map(players.map((player) => [player.id, 0]))
  for (const view of views) {
    progress.set(view.botId, sink.logs(view.id).length)
  }
  return { progress, durations, core }
}

const percentile = (values: number[], share: number) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length * share)]

describe('the engine under load', () => {
  jest.setTimeout(60000)

  it('keeps ticks within their budget and serves every one of 150 bots about equally', async () => {
    const players = Array.from({ length: 150 }, (_, i) => ({ id: `bot-${i}`, script: HONEST }))

    // The slice is real time: a generous one keeps a busy machine from ending honest scripts, which would only measure the machine
    const { progress, durations } = await stage(players, 40, { ...DEFAULT_ENGINE_CONFIG, sliceMs: 1000 })

    // Ticks may run over the interval a little (the cap defers the rest), but not by multiples of it
    expect(percentile(durations, 0.95)).toBeLessThan(DEFAULT_ENGINE_CONFIG.tickIntervalMs * 2.5)
    const counts = [...progress.values()]
    expect(Math.min(...counts)).toBeGreaterThan(5)
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(Math.ceil(Math.max(...counts) / 2))
  })

  it('does not let players whose scripts never stop slow the others down', async () => {
    const honest = Array.from({ length: 60 }, (_, i) => ({ id: `honest-${i}`, script: HONEST }))
    const hogs = Array.from({ length: 20 }, (_, i) => ({ id: `hog-${i}`, script: HOG }))

    const { progress, durations, core } = await stage([...honest, ...hogs], 40)

    for (const player of honest) {
      expect(progress.get(player.id)).toBeGreaterThan(5)
    }
    expect(percentile(durations, 0.95)).toBeLessThan(DEFAULT_ENGINE_CONFIG.tickIntervalMs * 2.5)
    // The hogs were killed by the slice, not left to run: only the honest ones are still going
    const [hogs0, honest0] = [core.list('owner-hog-0'), core.list('owner-honest-0')]
    await core.runTick()
    expect(await hogs0).toEqual([])
    expect(await honest0).toHaveLength(1)
  })
})
