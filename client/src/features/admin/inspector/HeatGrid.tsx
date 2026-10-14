'use client'

import type { IHeatmap } from '@lib/utils/admin-inspector'

const CELL = 16

interface HeatGridProps {
  heatmap: IHeatmap
  // The area the heatmap was asked for
  area: { minX: number; minY: number; side: number }
  label: string
}

// The buckets of a heatmap as a grid of squares, brighter where the value is higher
export default function HeatGrid({ heatmap, area, label }: HeatGridProps) {
  const columns = Math.ceil(area.side / heatmap.bucket)
  const size = columns * CELL

  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${size} ${size}`} width="100%" style={{ background: '#111' }}>
      {heatmap.buckets.map((bucket) => (
        <rect
          key={`${bucket.x},${bucket.y}`}
          x={((bucket.x - area.minX) / heatmap.bucket) * CELL}
          y={((bucket.y - area.minY) / heatmap.bucket) * CELL}
          width={CELL}
          height={CELL}
          fill="#ff7a00"
          fillOpacity={0.15 + 0.85 * bucket.intensity}
        >
          <title>{`(${bucket.x}, ${bucket.y}): ${Math.round(bucket.value * 100) / 100}`}</title>
        </rect>
      ))}
    </svg>
  )
}
