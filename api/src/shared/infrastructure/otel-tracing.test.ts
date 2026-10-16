import { testTelemetry } from '../../../tests/fakes/telemetry'

const PARENT = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'

describe('OtelTracing', () => {
  it('starts a trace, and spans started inside a span are its children', async () => {
    const { telemetry, spans } = testTelemetry()
    const { tracing } = telemetry

    expect(tracing.current()).toBeUndefined()
    expect(tracing.traceparent()).toBeUndefined()
    await tracing.withSpan('outer', {}, async () => {
      expect(tracing.current()?.traceId).toMatch(/^[0-9a-f]{32}$/)
      await Promise.resolve()
      await tracing.withSpan('inner', {}, () => undefined)
    })

    const [inner, outer] = spans()
    expect(inner.parentSpanContext?.spanId).toBe(outer.spanContext().spanId)
    expect(inner.spanContext().traceId).toBe(outer.spanContext().traceId)
    expect(outer.parentSpanContext).toBeUndefined()
  })

  it('continues the trace in a traceparent and hands its own on', () => {
    const { telemetry, spans } = testTelemetry()
    const { tracing } = telemetry
    let handedOn: string | undefined

    tracing.withSpan('server', { kind: 'server', parent: PARENT }, (span) => {
      handedOn = tracing.traceparent()
      expect(span.traceparent).toBe(handedOn)
      expect(span.context?.isSampled).toBe(true)
    })

    const [span] = spans()
    expect(span.spanContext().traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736')
    expect(span.parentSpanContext?.spanId).toBe('00f067aa0ba902b7')
    expect(span.kind).toBe(1)
    expect(handedOn).toBe(`00-4bf92f3577b34da6a3ce929d0e0e4736-${span.spanContext().spanId}-01`)
  })

  it('starts a span without any options', () => {
    const { telemetry, spans } = testTelemetry()

    telemetry.tracing.startSpan('bare').end()

    expect(spans().map((span) => span.name)).toEqual(['bare'])
  })

  it('keeps the decision of a caller that did not sample its trace', () => {
    const { telemetry, spans } = testTelemetry()

    telemetry.tracing.withSpan('server', { parent: PARENT.replace(/01$/, '00') }, (span) => {
      expect(span.context?.isSampled).toBe(false)
      expect(span.context?.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736')
    })

    expect(spans()).toHaveLength(0)
  })

  it('starts a new trace when asked to, even inside a span, and links the spans it is related to', () => {
    const { telemetry, spans } = testTelemetry()
    const { tracing } = telemetry

    tracing.withSpan('request', {}, (request) => {
      const execution = tracing.startSpan('execution', {
        isRoot: true,
        links: [request.traceparent as string, 'not a traceparent']
      })
      execution.end()
    })

    const [execution, request] = spans()
    expect(execution.spanContext().traceId).not.toBe(request.spanContext().traceId)
    expect(execution.parentSpanContext).toBeUndefined()
    expect(execution.links).toHaveLength(1)
    expect(execution.links[0].context.spanId).toBe(request.spanContext().spanId)
  })

  it('records the name, the attributes, the kind and a failure', () => {
    const { telemetry, spans } = testTelemetry()
    const span = telemetry.tracing.startSpan('old', { kind: 'client', attributes: { a: 1 } })

    span.rename('new')
    span.setAttribute('b', 'two')
    span.fail(new Error('boom'))
    span.fail('plain')
    span.end()

    const [finished] = spans()
    expect(finished).toMatchObject({ name: 'new', kind: 2, attributes: { a: 1, b: 'two' } })
    expect(finished.status).toEqual({ code: 2, message: 'plain' })
    expect(finished.events.map((event) => event.name)).toEqual(['exception', 'exception'])
  })

  it('gives a span that sampling dropped its ids, and keeps the decision of the parent', () => {
    const dropped = testTelemetry(0)
    const traceparents: Array<string | undefined> = []

    dropped.telemetry.tracing.withSpan('root', {}, (span) => {
      traceparents.push(span.traceparent)
      expect(span.context?.isSampled).toBe(false)
      dropped.telemetry.tracing.withSpan('child', {}, (child) => {
        expect(child.context?.traceId).toBe(span.context?.traceId)
      })
    })
    dropped.telemetry.tracing.withSpan('remote', { parent: PARENT }, (span) => {
      expect(span.context?.isSampled).toBe(true)
    })

    expect(traceparents[0]).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-00$/)
    expect(dropped.spans().map((span) => span.name)).toEqual(['remote'])
  })
})
