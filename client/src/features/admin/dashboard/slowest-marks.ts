import type { ISlowestSample } from '@lib/utils/admin'

export interface SlowestMark {
  // Index of the point of the chart the sample belongs to
  index: number
  sample: ISlowestSample
}

// Puts each slowest sample on the point of the chart nearest to its step; when several fall on one point the slowest stays
export function markOf(
  points: ReadonlyArray<ReadonlyArray<number>>,
  slowest: readonly ISlowestSample[]
): SlowestMark[] {
  const byPoint = new Map<number, ISlowestSample>()

  for (const sample of slowest) {
    let nearest = -1
    let distance = Infinity
    points.forEach(([time], index) => {
      const gap = Math.abs(time - sample.at)
      if (gap < distance) {
        distance = gap
        nearest = index
      }
    })
    const known = nearest === -1 ? undefined : byPoint.get(nearest)
    if (nearest !== -1 && (!known || sample.durationMs > known.durationMs)) {
      byPoint.set(nearest, sample)
    }
  }

  return [...byPoint].map(([index, sample]) => ({ index, sample }))
}
