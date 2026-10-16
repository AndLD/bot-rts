import type { ITraceSpan } from '@lib/utils/admin-logs'
import { layoutTrace } from './trace-layout'

const span = (spanId: string, parentSpanId: string | null, startedAt: number, durationMs: number): ITraceSpan => ({
  spanId,
  parentSpanId,
  name: spanId,
  kind: 'internal',
  service: 'botrts-api',
  node: 'host:1',
  startedAt,
  durationMs,
  status: 'ok'
})

describe('layoutTrace', () => {
  it('has nothing to draw for a trace without spans', () => {
    expect(layoutTrace([])).toEqual({ rows: [], durationMs: 0 })
  })

  it('orders the spans as a tree, each parent before its children, oldest sibling first, with the depth', () => {
    const { rows } = layoutTrace([
      span('late-child', 'root', 1030, 5),
      span('grandchild', 'child', 1012, 2),
      span('root', null, 1000, 50),
      span('child', 'root', 1010, 10)
    ])

    expect(rows.map((row) => [row.spanId, row.depth])).toEqual([
      ['root', 0],
      ['child', 1],
      ['grandchild', 2],
      ['late-child', 1]
    ])
  })

  it('puts the bars on the timeline of the whole trace, and keeps every bar visible', () => {
    const { rows, durationMs } = layoutTrace([span('root', null, 1000, 100), span('tiny', 'root', 1050, 0)])

    expect(durationMs).toBe(100)
    expect(rows[0]).toMatchObject({ offsetMs: 0, left: 0, width: 100 })
    expect(rows[1]).toMatchObject({ offsetMs: 50, left: 50, width: 0.5 })
  })

  it('shows a span whose parent is not in the trace at the top, and survives a trace of one instant', () => {
    const { rows, durationMs } = layoutTrace([span('orphan', 'missing', 1000, 0)])

    expect(rows[0]).toMatchObject({ depth: 0 })
    expect(durationMs).toBe(0)
  })
})
