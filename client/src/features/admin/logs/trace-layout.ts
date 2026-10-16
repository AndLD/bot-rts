import type { ITraceSpan } from '@lib/utils/admin-logs'

export interface SpanRow extends ITraceSpan {
  // How deep in the tree of the trace the span is (a span whose parent is not in the trace is at the top)
  depth: number
  // Where the bar starts and how wide it is, as shares of the whole trace
  left: number
  width: number
  // Milliseconds from the start of the trace
  offsetMs: number
}

export interface TraceLayout {
  rows: SpanRow[]
  durationMs: number
}

// Puts the spans in the order a reader follows them (a span, then its children, each oldest first) with the depth and the place of
// each bar on the timeline of the trace
export function layoutTrace(spans: readonly ITraceSpan[]): TraceLayout {
  if (spans.length === 0) {
    return { rows: [], durationMs: 0 }
  }
  const start = Math.min(...spans.map((span) => span.startedAt))
  const end = Math.max(...spans.map((span) => span.startedAt + span.durationMs))
  const total = Math.max(end - start, 0.001)
  const known = new Set(spans.map((span) => span.spanId))
  const children = new Map<string | null, ITraceSpan[]>()

  for (const span of spans) {
    const parent = span.parentSpanId && known.has(span.parentSpanId) ? span.parentSpanId : null
    children.set(parent, [...(children.get(parent) ?? []), span])
  }
  const rows: SpanRow[] = []
  const visit = (parent: string | null, depth: number) => {
    const siblings = [...(children.get(parent) ?? [])].sort((a, b) => a.startedAt - b.startedAt)
    for (const span of siblings) {
      rows.push({
        ...span,
        depth,
        offsetMs: span.startedAt - start,
        left: ((span.startedAt - start) / total) * 100,
        width: Math.max((span.durationMs / total) * 100, 0.5)
      })
      visit(span.spanId, depth + 1)
    }
  }
  visit(null, 0)

  return { rows, durationMs: end - start }
}
