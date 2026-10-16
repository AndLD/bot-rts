import { TraceContext } from '../../../../lib/utils/trace-context'

export const TRACING = Symbol('Tracing')

export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer'

export type SpanAttributes = Record<string, string | number | boolean>

export interface SpanOptions {
  kind?: SpanKind
  // The `traceparent` of the span this one continues: the caller of a request, the sender of a message. Without one the span
  // is a child of the active span, or the start of a new trace.
  parent?: string
  // Starts a new trace even inside an active span (a long script is linked to the call that started it, not its child)
  isRoot?: boolean
  // `traceparent`s of spans this one is related to without being their child
  links?: readonly string[]
  attributes?: SpanAttributes
}

export interface Span {
  // Absent only on the span of `NO_TRACING`
  readonly context: TraceContext | undefined
  // The form that is handed over a boundary; absent when there is no context
  readonly traceparent: string | undefined
  // For a name that is known only when the work is done (the route of a request)
  rename(name: string): void
  setAttribute(key: string, value: string | number | boolean): void
  // Marks the span as failed; the error is recorded, never thrown
  fail(error: unknown): void
  end(): void
  // Runs `work` with this span as the active one, so that the logs and the spans started inside belong to it
  run<T>(work: () => T): T
}

// Tracing as the application sees it (design §12: every record and every hop can be followed by a trace id). The adapter is
// OpenTelemetry; nothing outside the infrastructure layer knows that.
export interface Tracing {
  // For a span that outlives the call that starts it (an HTTP request, a script execution): the caller ends it
  startSpan(name: string, options?: SpanOptions): Span
  // Runs `work` inside a new span that ends when `work` returns, or when the promise it returns settles
  withSpan<T>(name: string, options: SpanOptions, work: (span: Span) => T): T
  // The context of the active span
  current(): TraceContext | undefined
  // The `traceparent` of the active span, to put into a message that leaves the thread or the process
  traceparent(): string | undefined
}

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  typeof (value as PromiseLike<unknown> | null)?.then === 'function'

// The one implementation of `withSpan`, over `startSpan`
export function withSpan<T>(tracing: Tracing, name: string, options: SpanOptions, work: (span: Span) => T): T {
  const span = tracing.startSpan(name, options)
  let result: T
  try {
    result = span.run(() => work(span))
  } catch (error) {
    span.fail(error)
    span.end()
    throw error
  }
  if (!isPromiseLike(result)) {
    span.end()
    return result
  }

  return result.then(
    (value) => {
      span.end()
      return value
    },
    (error: unknown) => {
      span.fail(error)
      span.end()
      throw error
    }
  ) as T
}

const NO_SPAN: Span = {
  context: undefined,
  traceparent: undefined,
  rename: () => undefined,
  setAttribute: () => undefined,
  fail: () => undefined,
  end: () => undefined,
  run: (work) => work()
}

// Where tracing is not wired (a unit test of a class that only passes the context on): spans do nothing and nothing is propagated
export const NO_TRACING: Tracing = {
  startSpan: () => NO_SPAN,
  withSpan: (_name, _options, work) => work(NO_SPAN),
  current: () => undefined,
  traceparent: () => undefined
}

// A scheduled job (a pass of the lifecycle, a sample of the monitor, a flush) runs in a trace of its own, so that what it logs
// can be found by one trace id
export function runJob<T>(tracing: Tracing, name: string, work: () => T): T {
  return withSpan(tracing, `job ${name}`, { isRoot: true }, () => work())
}
