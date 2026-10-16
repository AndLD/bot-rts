import { SpanRecord, TraceStore } from '../application/trace-store'

// The process keeps no spans, only the lines of its log: the trace view then shows the lines
export class MemoryTraceStore implements TraceStore {
  readonly name = 'memory' as const

  async spans(): Promise<SpanRecord[]> {
    return []
  }
}
