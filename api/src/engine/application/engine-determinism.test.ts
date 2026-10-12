import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { RESOURCE } from '../../../../lib/utils/interfaces/resources'
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
import { DEFAULT_MOVEMENT_BALANCE } from '../../bots/domain/movement'
import { StorageModule } from '../../modules/domain/game-module'
import { createModuleRegistry } from '../../modules/domain/module-registry'
import { SeededRng } from '../../shared/infrastructure/seeded-rng'
import { DEFAULT_ENGINE_CONFIG } from '../domain/engine-config'
import { QuickJsScriptRuntime } from '../infrastructure/quickjs-script-runtime'
import { BotCapacities } from './bot-capacities'
import { SucraseTranspiler } from '../infrastructure/sucrase-transpiler'
import { EngineCore } from './engine-core'
import { ModuleLoader } from './module-loader'
import { ManipulatorHandler } from './handlers/manipulator-handler'
import { MiningHandler } from './handlers/mining-handler'
import { MovementHandler } from './handlers/movement-handler'
import { FairScheduler, Scheduler } from './scheduler'
import { ScriptApi } from './script-api'
import { EventOutbox } from './event-outbox'
import { GameEventBus } from './game-event-bus'
import { LiveVision } from './live-vision'
import { RadioNetwork } from './radio-network'
import { WorldActionExecutor } from './world-action-executor'
import { WriteBehind } from './write-behind'

const at = (x: number, y: number) => ({ x, y, z: 0 })

// Collection order can differ between runs; the tests change it on purpose
class ReversingScheduler implements Scheduler {
  constructor(private readonly inner: Scheduler) {}
  plan(...args: Parameters<Scheduler['plan']>) {
    return this.inner.plan(...args).reverse()
  }
  deferred(...args: Parameters<Scheduler['deferred']>) {
    this.inner.deferred(...args)
  }
}

interface Scenario {
  seed: number
  isReversed: boolean
  script: string
  // Where each bot stands and which way it faces
  bots: Array<{ id: string; position: ReturnType<typeof at>; heading: 0 | 1 | 2 | 3 }>
  // Cells to prepare
  setup?: (world: ReturnType<typeof createEngineWorld>) => void
  ticks?: number
}

async function run({ seed, isReversed, script, bots, setup, ticks = 60 }: Scenario) {
  const runtime = await QuickJsScriptRuntime.create()
  const states = new FakeBotStateSource()
  const engine = createEngineWorld({ seed, states: states.states })
  const sources = new FakeScriptSource()
  const sink = new RecordingSink()
  const capacities = new BotCapacities()
  const config = DEFAULT_ENGINE_CONFIG
  const outbox = new EventOutbox(new FakeClock())
  const worldHandlers = [
    new MovementHandler(engine.world, DEFAULT_MOVEMENT_BALANCE, outbox),
    new MiningHandler(engine.world, outbox),
    new ManipulatorHandler(engine.world)
  ]
  const served = new Set(worldHandlers.flatMap((handler) => handler.functions))
  const others = SCRIPT_FUNCTIONS.filter((spec) => !spec.isScheduled && !served.has(spec.name)).map((spec) => spec.name)
  const scheduler = new FairScheduler(capacities, (s) => new SeededRng(s), seed)

  for (const bot of bots) {
    engine.addBot(bot.id, bot.position, FULL_KIT, { heading: bot.heading })
    states.states.set(bot.id, engine.source.bots.get(bot.id)!.state)
  }
  setup?.(engine)
  sources.files.set('/m/a.js', script)

  const core = new EngineCore({
    config,
    worldSeed: seed,
    createRng: (s) => new SeededRng(s),
    executions: new InMemoryExecutionRepository(),
    bots: states,
    modules: new ModuleLoader(sources, new SucraseTranspiler(), config.modules),
    runtime,
    api: new ScriptApi([...worldHandlers, { functions: others, handle: async () => ok(undefined) }]),
    scheduler: isReversed ? new ReversingScheduler(scheduler) : scheduler,
    capacities,
    registry: createModuleRegistry(),
    writeBehind: new WriteBehind({ flush: async () => undefined }, 10, 3),
    world: engine.world,
    vision: { restore: jest.fn(), refresh: jest.fn() } as unknown as LiveVision,
    radio: { refresh: jest.fn() } as unknown as RadioNetwork,
    outbox,
    bus: { deliver: jest.fn() } as unknown as GameEventBus,
    manualPolicy: { isAllowed: async () => true },
    actions: { execute: jest.fn() } as unknown as WorldActionExecutor,
    sink,
    ids: new SequentialIdGenerator(),
    clock: new FakeClock(),
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    monotonicMs: () => 0
  })

  // Start the scripts in an order that depends on the scenario, so that collection order differs too
  const order = isReversed ? [...bots].reverse() : bots
  const started = order.map((bot) =>
    core.start({ userId: `owner-${bot.id}`, botId: bot.id, file: '/m/a.js', args: [] })
  )
  for (let i = 0; i < ticks; i++) {
    await core.runTick()
  }
  const views = await Promise.all(started)

  const logs: Record<string, string[]> = {}
  for (const view of views) {
    logs[view.botId] = sink.logs(view.id)
  }
  const positions: Record<string, unknown> = {}
  for (const bot of bots) {
    positions[bot.id] = (await engine.world.bot(bot.id))!.position
  }
  return { logs, positions, engine }
}

const around = [
  { id: 'north', position: at(10, 9), heading: 2 as const },
  { id: 'south', position: at(10, 11), heading: 0 as const },
  { id: 'west', position: at(9, 10), heading: 1 as const },
  { id: 'east', position: at(11, 10), heading: 3 as const }
]

describe('collect then apply (design §12.4, §14.2)', () => {
  const moveInto = 'export async function main(bot) { const r = await bot.move(1); bot.log(r.ok ? "moved" : r.code) }'

  it('lets exactly one of four bots into a contested cell', async () => {
    const { logs, positions } = await run({ seed: 3, isReversed: false, script: moveInto, bots: around })

    const winners = Object.entries(logs).filter(([, lines]) => lines[0] === 'moved')
    const losers = Object.entries(logs).filter(([, lines]) => lines[0] === 'BLOCKED')
    expect(winners).toHaveLength(1)
    expect(losers).toHaveLength(3)
    expect(Object.values(positions).filter((p) => JSON.stringify(p) === JSON.stringify(at(10, 10)))).toHaveLength(1)
  })

  it('gives the same result for the same seed and commands, whoever was run or started first', async () => {
    const forward = await run({ seed: 3, isReversed: false, script: moveInto, bots: around })
    const again = await run({ seed: 3, isReversed: false, script: moveInto, bots: around })
    const reversed = await run({ seed: 3, isReversed: true, script: moveInto, bots: around })

    expect(again.logs).toEqual(forward.logs)
    expect(again.positions).toEqual(forward.positions)
    expect(reversed.logs).toEqual(forward.logs)
    expect(reversed.positions).toEqual(forward.positions)
  })

  it('does not always favour the same bot: the winner follows the seed of the tick', async () => {
    const winners = new Set<string>()
    for (let seed = 1; seed <= 30; seed++) {
      const { logs } = await run({ seed, isReversed: false, script: moveInto, bots: around, ticks: 60 })
      winners.add(Object.entries(logs).find(([, lines]) => lines[0] === 'moved')![0])
    }

    expect(winners.size).toBeGreaterThan(1)
  })

  it('shares a deposit between two bots whatever the order: nothing is lost or made', async () => {
    const dig = 'export async function main(bot) { const r = await bot.dig(); bot.log(r.ok ? r.data.amount : r.code) }'
    const bots = [
      { id: 'a', position: at(4, 5), heading: 1 as const },
      { id: 'b', position: at(6, 5), heading: 3 as const }
    ]
    const setup = (engine: ReturnType<typeof createEngineWorld>) =>
      engine.placeCell(at(5, 5), { type: MapPointType.RESOURCE, resource: { resource: RESOURCE.IRON, amount: 7 } })

    const forward = await run({ seed: 5, isReversed: false, script: dig, bots, setup })
    const reversed = await run({ seed: 5, isReversed: true, script: dig, bots, setup })

    const total = async (r: typeof forward) => {
      let sum = 0
      for (const id of ['a', 'b']) {
        sum += new StorageModule(
          (await r.engine.world.bot(id))!.state.modules.find((m) => m.type === 'storage')!
        ).amountOf(RESOURCE.IRON)
      }
      return sum
    }
    expect(await total(forward)).toBe(7)
    expect(await total(reversed)).toBe(7)
    expect(forward.logs).toEqual(reversed.logs)
    expect(Object.values(forward.logs).flat().sort()).toEqual(['2', '5'])
  })
})
