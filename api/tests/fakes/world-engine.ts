import { BOT_TYPE } from '../../../lib/utils/interfaces/bots'
import { MapPointType } from '../../../lib/utils/interfaces/map'
import { DEFAULT_RESOURCE_BALANCE, RESOURCE } from '../../../lib/utils/interfaces/resources'
import { BotState } from '../../src/engine/domain/bot-state'
import { World } from '../../src/engine/application/world/world'
import { NewCell, StoredBot, WorldSource } from '../../src/engine/application/world/world-source'
import { WriteBehind } from '../../src/engine/application/write-behind'
import { Item } from '../../src/crafting/domain/item.entity'
import { locationKey } from '../../src/map/domain/location'
import { KnownPoint, Location, LocationRange, MapPoint } from '../../src/map/domain/map-point.entity'
import { ModuleFactory } from '../../src/modules/application/module.factory'
import { EnergyModel } from '../../src/modules/domain/energy-model'
import { createModuleRegistry } from '../../src/modules/domain/module-registry'
import { WorldStateBatch } from '../../src/persistence/application/world-state-store'
import { SeededRng } from '../../src/shared/infrastructure/seeded-rng'
import { SequentialIdGenerator } from './fakes'

// What the stored world is made of, kept in plain maps
export class FakeWorldSource implements WorldSource {
  readonly bots = new Map<string, StoredBot>()
  // Bots that are known only as engine state, not placed on the map
  constructor(private readonly states: Map<string, BotState> = new Map()) {}

  readonly cells = new Map<string, MapPoint>()
  readonly items = new Map<string, Item>()
  readonly known: KnownPoint[] = []
  loads = 0

  async loadBot(botId: string) {
    const state = this.states.get(botId)
    return this.bots.get(botId) ?? (state ? { state, position: null, heading: 0 as const, carried: [] } : null)
  }

  async loadCells({ from, to }: LocationRange) {
    this.loads += 1
    const points = [...this.cells.values()].filter(
      ({ location: l }) => l.x >= from.x && l.x <= to.x && l.y >= from.y && l.y <= to.y && l.z === from.z
    )
    const items = points.flatMap((p) => (p.contentId ? (this.items.get(p.contentId) ?? []) : []))
    return { points, items }
  }

  async loadKnown(userId: string, { from, to }: LocationRange) {
    return this.known.filter(
      ({ userId: owner, location: l }) =>
        owner === userId && l.x >= from.x && l.x <= to.x && l.y >= from.y && l.y <= to.y && l.z === from.z
    )
  }

  async botIdsOfUser(userId: string) {
    return [...this.bots.values()].filter(({ state }) => state.ownerId === userId).map(({ state }) => state.bot.id)
  }

  async liveScannerBotIds() {
    return [...this.bots.values()]
      .filter(({ state }) => state.modules.some((m) => m.type === 'scanner' && m.props.isLive === true))
      .map(({ state }) => state.bot.id)
  }

  generate(location: Location): NewCell {
    return {
      point: { id: `cell-${locationKey(location)}`, location, type: null, contentId: null, resource: null },
      item: null
    }
  }

  hardnessOf(resource: RESOURCE) {
    return DEFAULT_RESOURCE_BALANCE[resource].hardness
  }
}

// A mobile bot with everything a script can use
export const FULL_KIT = [
  'processor-class1',
  'wireless-adapter-class1',
  'battery-class1',
  'engine-class1',
  'wheels-class1',
  'drill-class1',
  'manipulator-class1',
  'storage-class1',
  'gps-class1',
  'gun-class1'
]

export function createEngineWorld(
  options: { seed?: number; states?: Map<string, BotState>; writeBehind?: WriteBehind; maxChunks?: number } = {}
) {
  const source = new FakeWorldSource(options.states)
  const batches: WorldStateBatch[] = []
  const writeBehind =
    options.writeBehind ?? new WriteBehind({ flush: async (batch) => void batches.push(batch) }, 10, 3)
  const registry = createModuleRegistry()
  const energy = new EnergyModel(registry)
  const world = new World(
    source,
    writeBehind,
    registry,
    energy,
    16,
    (seed) => new SeededRng(seed),
    options.seed ?? 1,
    options.maxChunks ?? 512
  )
  const ids = new SequentialIdGenerator()
  const modules = new ModuleFactory(ids)
  world.beginTick(1)

  const placeCell = (location: Location, point: Partial<MapPoint> = {}) => {
    const cell: MapPoint = {
      id: `cell-${locationKey(location)}`,
      location,
      type: null,
      contentId: null,
      resource: null,
      ...point
    }
    source.cells.set(locationKey(location), cell)
    return cell
  }

  const addBot = (
    id: string,
    at: Location | null,
    kit: readonly string[] = FULL_KIT,
    options: { ownerId?: string; type?: BOT_TYPE; heading?: 0 | 1 | 2 | 3; baseId?: string } = {}
  ) => {
    const ownerId = options.ownerId ?? `owner-${id}`
    const records = kit.map((name) => modules.create(name, id))
    source.bots.set(id, {
      state: {
        bot: {
          id,
          label: null,
          type: options.type ?? BOT_TYPE.WORKER,
          userId: options.type === BOT_TYPE.BASE ? ownerId : null,
          baseId: options.baseId ?? null,
          passwordHash: null,
          lastPosition: null,
          heading: options.heading ?? 0
        },
        ownerId,
        modules: records
      },
      position: at,
      heading: options.heading ?? 0,
      carried: []
    })
    if (at) {
      placeCell(at, { type: MapPointType.BOT, contentId: id })
    }
    return records
  }

  return { world, source, writeBehind, batches, registry, energy, modules, placeCell, addBot }
}
