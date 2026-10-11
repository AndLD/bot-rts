import { Location, LocationRange } from './map-point.entity'

// A chunk is a square block of cells addressed by its own integer coordinates; negative cells belong to negative
// chunks (floor division), so the map stays sparse and unbounded in every direction
export interface ChunkCoord {
  readonly cx: number
  readonly cy: number
}

export function locationKey({ x, y, z }: Location): string {
  return `${x}:${y}:${z}`
}

// x-major order, the order cells are listed in
export function compareLocations(a: Location, b: Location): number {
  return a.x - b.x || a.y - b.y || a.z - b.z
}

export function chunkOf({ x, y }: Pick<Location, 'x' | 'y'>, chunkSize: number): ChunkCoord {
  return { cx: Math.floor(x / chunkSize), cy: Math.floor(y / chunkSize) }
}

// The part of `range` that lies in each chunk it touches, in chunk order (a range never has to be loaded whole)
export function splitByChunk(range: LocationRange, chunkSize: number): LocationRange[] {
  const first = chunkOf(range.from, chunkSize)
  const last = chunkOf(range.to, chunkSize)
  const parts: LocationRange[] = []

  for (let cx = first.cx; cx <= last.cx; cx += 1) {
    for (let cy = first.cy; cy <= last.cy; cy += 1) {
      parts.push({
        from: {
          x: Math.max(range.from.x, cx * chunkSize),
          y: Math.max(range.from.y, cy * chunkSize),
          z: range.from.z
        },
        to: {
          x: Math.min(range.to.x, (cx + 1) * chunkSize - 1),
          y: Math.min(range.to.y, (cy + 1) * chunkSize - 1),
          z: range.to.z
        }
      })
    }
  }
  return parts
}

// Every cell of a range, x-major
export function* cellsOf({ from, to }: LocationRange): Generator<Location> {
  for (let x = from.x; x <= to.x; x += 1) {
    for (let y = from.y; y <= to.y; y += 1) {
      for (let z = from.z; z <= to.z; z += 1) {
        yield { x, y, z }
      }
    }
  }
}
