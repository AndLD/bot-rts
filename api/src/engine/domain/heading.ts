import { Heading, Location } from '../../../../lib/utils/interfaces/map'
import { Location as Cell } from '../../map/domain/map-point.entity'

// North is toward smaller y, east toward larger x (design §10.2)
const STEPS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 }
]

// The cell `steps` cells ahead of `from`
export function ahead(from: Location, heading: Heading, steps = 1): Cell {
  const { dx, dy } = STEPS[heading]
  return { x: from.x + dx * steps, y: from.y + dy * steps, z: from.z ?? 0 }
}

export function turned(heading: Heading, direction: 'left' | 'right'): Heading {
  return ((heading + (direction === 'right' ? 1 : 3)) % 4) as Heading
}

// Whether two cells touch, diagonals included, and are not the same cell
export function isNeighbour(a: Cell, b: Cell): boolean {
  const distance = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
  return distance === 1 && a.z === b.z
}
