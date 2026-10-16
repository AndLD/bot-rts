import { EventEmitter } from 'events'
import { testTelemetry } from '../../../tests/fakes/telemetry'
import { traceSocketEvents } from './socket-tracing'

type Middleware = (packet: unknown[], next: () => void) => void

function connect() {
  const traced = testTelemetry()
  const server = new EventEmitter()
  const middlewares: Middleware[] = []

  traceSocketEvents(server as never, traced.telemetry.tracing)
  server.emit('connection', { use: (middleware: Middleware) => middlewares.push(middleware) })

  return { traced, middlewares }
}

describe('traceSocketEvents', () => {
  it('runs the handler inside a span of the event, which ends when the event is acknowledged', () => {
    const { traced, middlewares } = connect()
    const ack = jest.fn()
    const packet: unknown[] = ['bots:list', 'b1', ack]
    let handlerTrace: string | undefined

    middlewares[0](packet, () => {
      handlerTrace = traced.telemetry.tracing.current()?.traceId
      expect(traced.spans()).toHaveLength(0)
      ;(packet[2] as (result: unknown) => void)({ ok: true })
    })

    const [span] = traced.spans()
    expect(span.name).toBe('socket bots:list')
    expect(span.spanContext().traceId).toBe(handlerTrace)
    expect(span.kind).toBe(1)
    expect(span.attributes).toMatchObject({
      'messaging.system': 'socket.io',
      'messaging.destination.name': 'bots:list'
    })
    expect(ack).toHaveBeenCalledWith({ ok: true })
    expect(span.status.code).toBe(0)
  })

  it('marks an event that was answered with an error as failed', () => {
    const { traced, middlewares } = connect()
    const packet: unknown[] = ['bots:list', jest.fn()]

    middlewares[0](packet, () =>
      (packet[1] as (result: unknown, error: unknown) => void)(null, { code: 403, msg: 'No' })
    )

    expect(traced.spans()[0].status).toEqual({ code: 2, message: 'No' })
  })

  it('ends the span of an event without an acknowledgement after the handler has had its turn', async () => {
    const { traced, middlewares } = connect()
    const next = jest.fn()

    middlewares[0](['ping'], next)
    expect(traced.spans()).toHaveLength(0)
    await new Promise((resolve) => setImmediate(resolve))

    expect(next).toHaveBeenCalled()
    expect(traced.spans().map((span) => span.name)).toEqual(['socket ping'])
  })
})
