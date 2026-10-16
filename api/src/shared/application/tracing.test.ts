import { NO_TRACING, runJob, Span, Tracing, withSpan } from './tracing'

function recordingTracing() {
  const events: string[] = []
  const span: Span = {
    context: undefined,
    traceparent: undefined,
    rename: jest.fn(),
    setAttribute: jest.fn(),
    fail: (error) => void events.push(`fail ${String(error)}`),
    end: () => void events.push('end'),
    run: (work) => {
      events.push('run')
      return work()
    }
  }
  const tracing: Tracing = {
    startSpan: (name) => {
      events.push(`start ${name}`)
      return span
    },
    withSpan: (name, options, work) => withSpan(tracing, name, options, work),
    current: () => undefined,
    traceparent: () => undefined
  }

  return { tracing, events }
}

describe('withSpan', () => {
  it('runs the work inside the span and ends it when a plain value comes back', () => {
    const { tracing, events } = recordingTracing()

    expect(withSpan(tracing, 'work', {}, () => 5)).toBe(5)
    expect(events).toEqual(['start work', 'run', 'end'])
  })

  it('records a thrown error, ends the span and throws it on', () => {
    const { tracing, events } = recordingTracing()

    expect(() =>
      withSpan(tracing, 'work', {}, () => {
        throw new Error('boom')
      })
    ).toThrow('boom')
    expect(events).toEqual(['start work', 'run', 'fail Error: boom', 'end'])
  })

  it('ends the span only when the promise settles', async () => {
    const { tracing, events } = recordingTracing()
    let finish: (value: number) => void = () => undefined
    const pending = withSpan(tracing, 'work', {}, () => new Promise<number>((resolve) => (finish = resolve)))

    expect(events).toEqual(['start work', 'run'])
    finish(7)

    await expect(pending).resolves.toBe(7)
    expect(events).toEqual(['start work', 'run', 'end'])
  })

  it('records a rejection and rejects the same way', async () => {
    const { tracing, events } = recordingTracing()

    await expect(withSpan(tracing, 'work', {}, () => Promise.reject(new Error('late')))).rejects.toThrow('late')
    expect(events).toEqual(['start work', 'run', 'fail Error: late', 'end'])
  })
})

describe('runJob', () => {
  it('runs the work in a span named after the job, in a trace of its own', () => {
    const startSpan = jest.fn(() => recordingTracing().tracing.startSpan('x'))
    const tracing: Tracing = { ...NO_TRACING, startSpan }

    runJob(tracing, 'flush', () => 1)

    expect(startSpan).toHaveBeenCalledWith('job flush', { isRoot: true })
  })
})

describe('NO_TRACING', () => {
  it('does nothing and propagates nothing', () => {
    const span = NO_TRACING.startSpan('x')

    expect(NO_TRACING.withSpan('x', {}, (inner) => inner === span)).toBe(true)
    expect(span.run(() => 3)).toBe(3)
    expect(() => {
      span.rename('y')
      span.setAttribute('a', 1)
      span.fail('e')
      span.end()
    }).not.toThrow()
    expect([span.context, span.traceparent, NO_TRACING.current(), NO_TRACING.traceparent()]).toEqual([
      undefined,
      undefined,
      undefined,
      undefined
    ])
  })
})
