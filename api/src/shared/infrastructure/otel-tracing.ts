import { context, ROOT_CONTEXT, SpanKind as OtelSpanKind, SpanStatusCode, trace, Tracer } from '@opentelemetry/api'
import type { Context, Link, Span as OtelSpan, SpanContext } from '@opentelemetry/api'
import { formatTraceparent, parseTraceparent, TraceContext } from '../../../../lib/utils/trace-context'
import { Span, SpanKind, SpanOptions, Tracing, withSpan } from '../application/tracing'

const KINDS: Record<SpanKind, OtelSpanKind> = {
  internal: OtelSpanKind.INTERNAL,
  server: OtelSpanKind.SERVER,
  client: OtelSpanKind.CLIENT,
  producer: OtelSpanKind.PRODUCER,
  consumer: OtelSpanKind.CONSUMER
}

const SAMPLED = 1

function toSpanContext({ traceId, spanId, isSampled }: TraceContext): SpanContext {
  return { traceId, spanId, traceFlags: isSampled ? SAMPLED : 0, isRemote: true }
}

function toTraceContext({ traceId, spanId, traceFlags }: SpanContext): TraceContext {
  return { traceId, spanId, isSampled: (traceFlags & SAMPLED) === SAMPLED }
}

class OtelSpanHandle implements Span {
  readonly context: TraceContext
  readonly traceparent: string

  constructor(
    private readonly span: OtelSpan,
    private readonly parent: Context
  ) {
    this.context = toTraceContext(span.spanContext())
    this.traceparent = formatTraceparent(this.context)
  }

  rename(name: string): void {
    this.span.updateName(name)
  }

  setAttribute(key: string, value: string | number | boolean): void {
    this.span.setAttribute(key, value)
  }

  fail(error: unknown): void {
    this.span.recordException(error instanceof Error ? error : String(error))
    this.span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : String(error) })
  }

  end(): void {
    this.span.end()
  }

  run<T>(work: () => T): T {
    return context.with(trace.setSpan(this.parent, this.span), work)
  }
}

// Tracing over the OpenTelemetry API. A span that sampling dropped still has its trace id and span id, so the logs written
// inside it keep them and can be found by the trace id.
export class OtelTracing implements Tracing {
  constructor(private readonly tracer: Tracer) {}

  startSpan(name: string, options: SpanOptions = {}): Span {
    const remote = parseTraceparent(options.parent)
    const parent = options.isRoot
      ? ROOT_CONTEXT
      : remote
        ? trace.setSpanContext(ROOT_CONTEXT, toSpanContext(remote))
        : context.active()
    const links = (options.links ?? []).flatMap((value): Link[] => {
      const linked = parseTraceparent(value)
      return linked ? [{ context: toSpanContext(linked) }] : []
    })
    const span = this.tracer.startSpan(
      name,
      { kind: KINDS[options.kind ?? 'internal'], attributes: options.attributes, links },
      parent
    )

    return new OtelSpanHandle(span, parent)
  }

  withSpan<T>(name: string, options: SpanOptions, work: (span: Span) => T): T {
    return withSpan(this, name, options, work)
  }

  current(): TraceContext | undefined {
    const active = trace.getActiveSpan()?.spanContext()

    return active && trace.isSpanContextValid(active) ? toTraceContext(active) : undefined
  }

  traceparent(): string | undefined {
    const current = this.current()

    return current ? formatTraceparent(current) : undefined
  }
}
