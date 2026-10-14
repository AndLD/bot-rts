import {
  HeatmapKind,
  HEATMAP_BUCKETS,
  HEATMAP_MAX_SIDE,
  IHeatmap,
  IInspectorBot,
  IInspectorFile,
  IInspectorFileContent,
  IInspectorSearchResult
} from '../../../../lib/utils/admin-inspector'
import { BOT_TYPE } from '../../../../lib/utils/interfaces/bots'
import { IMapRange, IMapView, MapPointType } from '../../../../lib/utils/interfaces/map'
import { RESOURCES, ResourceBalance } from '../../../../lib/utils/interfaces/resources'
import { isDirectChild } from '../../files/domain/file-path'
import { LocationRange } from '../../map/domain/map-point.entity'
import { BatteryModule, DriveModule, StorageModule } from '../../modules/domain/game-module'
import { MapViewService } from '../../mapview/application/map-view.service'
import { Module } from '../../modules/domain/module.entity'
import { Repositories, UnitOfWork } from '../../persistence/application/unit-of-work'
import { NotFoundError, ValidationError } from '../../shared/domain/errors'
import { bucketize, HeatSample, parseCoordinates } from '../domain/heatmap'
import { InspectorReadModel } from './ports'

const EXECUTIONS_SHOWN = 20
const LOGS_SHOWN = 50
const IS_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface HeatmapQuery {
  kind: HeatmapKind
  range: IMapRange
  bucket: number
}

// Read-only inspection of any base or bot, and of the whole world without fog of war (design §25.3, §25.4). Nothing here
// changes the world; opening a file is audited by the caller.
export class InspectorService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly readModel: InspectorReadModel,
    private readonly mapView: MapViewService,
    private readonly resources: ResourceBalance
  ) {}

  async bot(botId: string): Promise<IInspectorBot> {
    const { bot, owner, modules, files, point } = await this.unitOfWork.run(async (repositories) => {
      const found = await repositories.bots.findById(botId)

      if (!found) {
        throw new NotFoundError('Bot not found')
      }
      const base = found.baseId ? await repositories.bots.findById(found.baseId) : found
      const ownerId = found.userId ?? base?.userId ?? null
      const records = await repositories.modules.listOfBot(botId)
      const drives = records.filter((record) => record.type === 'drive')

      return {
        bot: found,
        owner: ownerId ? await repositories.users.findById(ownerId) : null,
        modules: records,
        files: new Map(
          await Promise.all(
            drives.map(async (drive) => [drive.id, await repositories.files.usedBytes(drive.id)] as const)
          )
        ),
        point: await repositories.map.findPointByContentId(botId)
      }
    })
    const batteries = modules.filter((module) => module.type === 'battery').map((module) => new BatteryModule(module))
    const storages = modules.filter((module) => module.type === 'storage').map((module) => new StorageModule(module))
    const [executions, logs] = await Promise.all([
      this.readModel.recentExecutions(botId, EXECUTIONS_SHOWN),
      this.readModel.recentLogs(botId, LOGS_SHOWN)
    ])

    return {
      _id: bot.id,
      label: bot.label,
      type: bot.type === BOT_TYPE.BASE ? 'base' : 'worker',
      ownerId: owner?.id ?? null,
      ownerName: owner?.name ?? null,
      baseId: bot.baseId,
      position: point ? { x: point.location.x, y: point.location.y } : null,
      heading: bot.heading,
      energy: {
        stored: batteries.reduce((sum, battery) => sum + battery.value, 0),
        capacity: batteries.reduce((sum, battery) => sum + battery.capacity, 0)
      },
      storage: RESOURCES.map((resource) => ({
        resource,
        amount: storages.reduce((sum, storage) => sum + storage.amountOf(resource), 0)
      })).filter(({ amount }) => amount > 0),
      modules: modules.map(({ id, type, name, condition, maxCondition, weight, props }) => ({
        _id: id,
        type,
        name,
        condition,
        maxCondition,
        weight,
        props: Object.fromEntries(Object.entries(props).map(([key, value]) => [key, JSON.stringify(value)]))
      })),
      drives: modules
        .filter((module) => module.type === 'drive')
        .map((module) => ({
          _id: module.id,
          name: module.name,
          quota: new DriveModule(module).quota,
          usedBytes: files.get(module.id) ?? 0
        })),
      executions: executions.map((execution) => ({
        _id: execution.id,
        file: execution.file,
        status: execution.status,
        restarts: execution.restarts,
        reason: execution.reason,
        createdAt: execution.createdAt.getTime(),
        endedAt: execution.endedAt?.getTime() ?? null
      })),
      logs: logs.map((line) => ({ at: line.at.getTime(), kind: line.kind, text: line.text }))
    }
  }

  async listFiles(botId: string, driveId: string, directory: string | null): Promise<IInspectorFile[]> {
    return this.unitOfWork.run(async (repositories) => {
      await this.requireDrive(repositories, botId, driveId)

      return (await repositories.files.listOfDrive(driveId))
        .filter((file) => isDirectChild(file.path, directory))
        .map(({ path, kind, size }) => ({ path, kind, size }))
    })
  }

  async readFile(botId: string, driveId: string, path: string): Promise<IInspectorFileContent> {
    return this.unitOfWork.run(async (repositories) => {
      await this.requireDrive(repositories, botId, driveId)
      const file = await repositories.files.findByPath(driveId, path)

      if (!file || file.kind !== 'file') {
        throw new NotFoundError('File not found')
      }

      return { path: file.path, size: file.size, content: file.content }
    })
  }

  // By the id of a bot, a base or a player, or by the cell "x,y"
  async search(query: string): Promise<IInspectorSearchResult[]> {
    const text = query.trim()
    const cell = parseCoordinates(text)

    if (cell) {
      return this.cellAt(cell)
    }
    if (!IS_UUID.test(text)) {
      throw new ValidationError('Enter the id of a bot, a base or a player, or a cell like 12,-4')
    }

    return this.unitOfWork.run(async ({ bots, users, map }) => {
      const results: IInspectorSearchResult[] = []
      const bot = await bots.findById(text)
      const user = await users.findById(text)

      if (bot) {
        const point = await map.findPointByContentId(bot.id)
        results.push({
          kind: bot.type === BOT_TYPE.BASE ? 'base' : 'bot',
          id: bot.id,
          label: bot.label ?? bot.id,
          x: point?.location.x ?? null,
          y: point?.location.y ?? null
        })
      }
      if (user) {
        results.push({ kind: 'player', id: user.id, label: user.name, x: null, y: null })
      }

      return results
    })
  }

  // The map as it is, with every bot and base shown as the viewer's own
  worldView(range: IMapRange): Promise<IMapView> {
    return this.mapView.worldView(range)
  }

  async heatmap({ kind, range, bucket }: HeatmapQuery): Promise<IHeatmap> {
    const side = Math.max(range.maxX - range.minX, range.maxY - range.minY) + 1

    if (!(HEATMAP_BUCKETS as readonly number[]).includes(bucket) || side > HEATMAP_MAX_SIDE || side < 1) {
      throw new ValidationError('Invalid heatmap area or bucket size')
    }
    const area = { from: { x: range.minX, y: range.minY, z: 0 }, to: { x: range.maxX, y: range.maxY, z: 0 } }
    const samples: HeatSample[] =
      kind === 'activity'
        ? (await this.readModel.activeExecutionLocations(area)).map(({ x, y }) => ({ x, y, value: 1 }))
        : await this.pointSamples(kind, area)

    return { kind, bucket, buckets: bucketize(samples, bucket, kind) }
  }

  private async pointSamples(kind: 'density' | 'depletion', area: LocationRange): Promise<HeatSample[]> {
    const points = await this.unitOfWork.run(({ map }) => map.findPointsInRange(area))

    if (kind === 'density') {
      return points.filter((point) => point.type !== null).map((point) => ({ ...point.location, value: 1 }))
    }

    return points
      .filter((point) => point.type === MapPointType.RESOURCE && point.resource)
      .map((point) => {
        const resource = point.resource as NonNullable<typeof point.resource>
        const capacity = this.resources[resource.resource].maxAmount

        return { ...point.location, value: Math.min(1, Math.max(0, 1 - resource.amount / capacity)) }
      })
  }

  private async cellAt({ x, y }: { x: number; y: number }): Promise<IInspectorSearchResult[]> {
    const [point] = await this.unitOfWork.run(({ map }) =>
      map.findPointsInRange({ from: { x, y, z: 0 }, to: { x, y, z: 0 } })
    )

    return [
      {
        kind: 'cell',
        id: point?.contentId ?? null,
        label: point?.type ?? 'empty',
        x,
        y
      }
    ]
  }

  private async requireDrive(repositories: Repositories, botId: string, driveId: string): Promise<Module> {
    const drive = (await repositories.modules.listOfBot(botId)).find(
      (module) => module.id === driveId && module.type === 'drive'
    )

    if (!drive) {
      throw new NotFoundError('Drive not found')
    }

    return drive
  }
}
