'use client'

import { useMemo } from 'react'

const WIDTH = 320
const HEIGHT = 96
const PAD = 4

interface LineChartProps {
  points: ReadonlyArray<ReadonlyArray<number>>
  // Names the chart for assistive technology
  label: string
  // Formats the extremes drawn at the corners
  format: (value: number) => string
}

// A small SVG line chart: time runs left to right, the vertical scale is from zero to the highest value
export default function LineChart({ points, label, format }: LineChartProps) {
  const path = useMemo(() => {
    if (points.length === 0) {
      return null
    }
    const [firstTime] = points[0]
    const lastTime = points[points.length - 1][0]
    const span = Math.max(1, lastTime - firstTime)
    const max = Math.max(...points.map(([, value]) => value), Number.EPSILON)
    const x = (time: number) => PAD + ((time - firstTime) / span) * (WIDTH - 2 * PAD)
    const y = (value: number) => HEIGHT - PAD - (value / max) * (HEIGHT - 2 * PAD)

    return {
      max,
      line: points
        .map(([time, value], index) => `${index === 0 ? 'M' : 'L'}${x(time).toFixed(1)},${y(value).toFixed(1)}`)
        .join(' ')
    }
  }, [points])

  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" style={{ display: 'block' }}>
      {path ? (
        <>
          <path d={path.line} fill="none" stroke="currentColor" strokeWidth={1.5} />
          <text x={WIDTH - PAD} y={10} textAnchor="end" fontSize={10} fill="currentColor">
            {format(path.max)}
          </text>
        </>
      ) : null}
    </svg>
  )
}
