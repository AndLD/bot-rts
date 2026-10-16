// The W3C Trace Context (https://www.w3.org/TR/trace-context/) as a plain value, shared by the API, the engine and the MCP
// server. `traceparent` is the only form in which a context crosses a boundary of ours (a header, a thread message, Redis).
export const TRACEPARENT_HEADER = 'traceparent'

export interface TraceContext {
  traceId: string
  spanId: string
  isSampled: boolean
}

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/
const NO_TRACE_ID = '0'.repeat(32)
const NO_SPAN_ID = '0'.repeat(16)
const SAMPLED_FLAG = 1

// A malformed header, or one with an all-zero id, is not a context: the caller then starts a trace of its own
export function parseTraceparent(value: string | null | undefined): TraceContext | undefined {
  const match = value ? TRACEPARENT.exec(value.trim().toLowerCase()) : null
  if (!match || match[1] === NO_TRACE_ID || match[2] === NO_SPAN_ID) {
    return undefined
  }

  return { traceId: match[1], spanId: match[2], isSampled: (parseInt(match[3], 16) & SAMPLED_FLAG) === SAMPLED_FLAG }
}

export function formatTraceparent({ traceId, spanId, isSampled }: TraceContext): string {
  return `00-${traceId}-${spanId}-${isSampled ? '01' : '00'}`
}
