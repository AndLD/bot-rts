import { ILiveArea, IMapCell, MapPointType } from '@lib/utils/interfaces/map'
import { CellContent, MapCell } from './renderer/model'

// What the radio network last said about a bot (design §11.2.1)
export interface BotLink {
  isConnected: boolean
  bars: number
  // The time the link was lost, in the map's clock
  lostAt?: number
}

const isInside = (area: ILiveArea, x: number, y: number) =>
  Math.abs(x - area.x) <= area.radius && Math.abs(y - area.y) <= area.radius

export const isLiveAt = (areas: readonly ILiveArea[], x: number, y: number) =>
  areas.some((area) => isInside(area, x, y))

function contentOf(cell: IMapCell, link: BotLink | undefined): CellContent {
  const owner = cell.isOwn ? 'own' : 'enemy'

  switch (cell.type) {
    case MapPointType.RESOURCE:
      return cell.resource
        ? {
            kind: 'resource',
            resource: cell.resource.resource,
            amount: cell.resource.amount,
            capacity: cell.capacity ?? cell.resource.amount
          }
        : { kind: 'empty' }
    case MapPointType.ITEM:
      return { kind: 'item', item: cell.item ?? 'generic' }
    case MapPointType.BOT:
      return {
        kind: 'bot',
        botId: cell.contentId ?? undefined,
        owner,
        chassis: cell.chassis ?? 'wheels',
        overlays: cell.icons ?? [],
        isDamaged: cell.isDamaged ?? false,
        isStale: false,
        ...(link?.isConnected ? { signal: link.bars } : {}),
        ...(link && !link.isConnected ? { linkLostAt: link.lostAt ?? 0 } : {})
      }
    case MapPointType.BASE:
      return { kind: 'base', botId: cell.contentId ?? undefined, owner, isCorpse: false }
    case MapPointType.CORPSE_BASE:
      return { kind: 'base', botId: cell.contentId ?? undefined, owner, isCorpse: true }
    default:
      return { kind: 'empty' }
  }
}

// A cell from the API, ready for the renderer
export function toMapCell(cell: IMapCell, areas: readonly ILiveArea[], link?: BotLink): MapCell {
  return {
    x: cell.x,
    y: cell.y,
    content: contentOf(cell, link),
    seenAt: cell.seenAt,
    isLive: isLiveAt(areas, cell.x, cell.y)
  }
}
