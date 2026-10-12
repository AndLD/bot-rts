import { CellContent, MapCell } from './model'

// The sprites a cell is made of, bottom to top
export interface SpriteLayers {
  base: string
  overlays: string[]
}

const FILL_FULL = 0.66
const FILL_HALF = 0.33

// A deposit shows how much is left of it
export function resourceSprite(resource: string, amount: number, capacity: number) {
  const fraction = capacity > 0 ? amount / capacity : 1
  const level = fraction > FILL_FULL ? 'full' : fraction > FILL_HALF ? 'half' : 'low'

  return `resource_${resource}_${level}`
}

export function layersOf(content: CellContent): SpriteLayers {
  switch (content.kind) {
    case 'empty':
      return { base: 'ground', overlays: [] }
    case 'resource':
      return { base: resourceSprite(content.resource, content.amount, content.capacity), overlays: [] }
    case 'item':
      return { base: `item_${content.item}`, overlays: [] }
    case 'bot':
      return {
        base: `chassis_${content.chassis}`,
        overlays: [
          ...content.overlays.map((overlay) => `overlay_${overlay}`),
          ...(content.isDamaged ? ['overlay_cracked'] : [])
        ]
      }
    case 'base':
      return { base: content.isCorpse ? 'base_corpse' : 'base', overlays: [] }
  }
}

// A remembered bot or item of someone else may be gone: it is drawn as a last-seen ghost
export const isGhost = (cell: MapCell) =>
  !cell.isLive && (cell.content.kind === 'item' || (cell.content.kind === 'bot' && cell.content.owner === 'enemy'))
