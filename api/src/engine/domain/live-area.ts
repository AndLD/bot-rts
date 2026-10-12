import { Location } from '../../map/domain/map-point.entity'
import { chunkOf } from '../../map/domain/location'

// The square a live scanner keeps live (design §4.4)
export interface LiveArea {
  readonly scannerId: string
  readonly botId: string
  // The player who sees it
  readonly userId: string
  readonly center: Location
  // Radius in cells
  readonly radius: number
}

export function areaContains({ center, radius }: Pick<LiveArea, 'center' | 'radius'>, location: Location): boolean {
  return (
    location.z === center.z && Math.abs(location.x - center.x) <= radius && Math.abs(location.y - center.y) <= radius
  )
}

// Every cell of the square, in a stable order
export function areaCells({ center, radius }: Pick<LiveArea, 'center' | 'radius'>): Location[] {
  const cells: Location[] = []
  for (let x = center.x - radius; x <= center.x + radius; x += 1) {
    for (let y = center.y - radius; y <= center.y + radius; y += 1) {
      cells.push({ x, y, z: center.z })
    }
  }
  return cells
}

// The chunks the square touches, as keys of the subscription index
export function areaChunks(area: Pick<LiveArea, 'center' | 'radius'>, chunkSize: number): string[] {
  const from = chunkOf({ x: area.center.x - area.radius, y: area.center.y - area.radius }, chunkSize)
  const to = chunkOf({ x: area.center.x + area.radius, y: area.center.y + area.radius }, chunkSize)
  const keys: string[] = []
  for (let cx = from.cx; cx <= to.cx; cx += 1) {
    for (let cy = from.cy; cy <= to.cy; cy += 1) {
      keys.push(`${cx}:${cy}:${area.center.z}`)
    }
  }
  return keys
}
