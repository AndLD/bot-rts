import { ITraceSpan, LogStoreName } from '../../../../lib/utils/admin-logs'

export const TRACE_STORE = Symbol('TraceStore')

export interface SpanRecord extends Omit<ITraceSpan, 'startedAt'> {
  startedAt: Date
}

// Where the console reads the spans of a trace from (design §25.3). The spans of the nodes are kept next to their logs; a deployment
// without the log store keeps none, and a trace is then only its logs.
export interface TraceStore {
  readonly name: LogStoreName
  // The spans of the trace, oldest first
  spans(traceId: string): Promise<SpanRecord[]>
}
