import { HeatmapKind, IHeatBucket } from '../../../../lib/utils/admin-inspector'

export interface HeatSample {
  x: number
  y: number
  // What the point counts for in this kind of heatmap, 0..1 for depletion
  value: number
}

// Groups samples into square buckets of `size` cells, adds up the values of a bucket (density, activity) or averages them
// (depletion), and scales the result to the busiest bucket
export function bucketize(samples: readonly HeatSample[], size: number, kind: HeatmapKind): IHeatBucket[] {
  const sums = new Map<string, { x: number; y: number; sum: number; count: number }>()

  for (const sample of samples) {
    const x = Math.floor(sample.x / size) * size
    const y = Math.floor(sample.y / size) * size
    const key = `${x},${y}`
    const bucket = sums.get(key) ?? { x, y, sum: 0, count: 0 }
    bucket.sum += sample.value
    bucket.count += 1
    sums.set(key, bucket)
  }
  const buckets = [...sums.values()].map(({ x, y, sum, count }) => ({
    x,
    y,
    value: kind === 'depletion' ? sum / count : sum
  }))
  const max = Math.max(...buckets.map((bucket) => bucket.value), 0)

  return buckets
    .map((bucket) => ({ ...bucket, intensity: max > 0 ? bucket.value / max : 0 }))
    .sort((a, b) => a.y - b.y || a.x - b.x)
}

// "12,-4", "12 -4" or "(12, -4)" -> the cell, or null
export function parseCoordinates(text: string): { x: number; y: number } | null {
  const match = /^\(?\s*(-?\d+)\s*[,\s]\s*(-?\d+)\s*\)?$/.exec(text.trim())

  return match ? { x: Number(match[1]), y: Number(match[2]) } : null
}
