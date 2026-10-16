import { RedisBus } from '../../../tests/fakes/redis-bus'
import { testTelemetry } from '../../../tests/fakes/telemetry'
import { RedisEngineBridge } from '../../redis/infrastructure/redis-engine-bridge'
import { RedisEnginePort } from '../../redis/infrastructure/redis-engine-port'
import { Tracing } from '../../shared/application/tracing'
import { NotFoundError } from '../../shared/domain/errors'
import { EngineCore } from '../application/engine-core'
import { ControlMessage, EngineMessage, MessageChannel } from '../application/engine-protocol'
import { EngineEvent } from '../application/engine-ports'
import { EngineHost, ChannelSink } from './engine-host'
import { ChannelEnginePort, DisabledEnginePort } from './worker-engine-port'

// What the engine does, and the trace it did it in
function fakeCore(tracing: Tracing, seen: Array<string | undefined>) {
  return {
    manual: jest.fn(async () => {
      seen.push(tracing.current()?.traceId)
      return { ok: true }
    }),
    kill: jest.fn(async () => {
      throw new NotFoundError('gone')
    }),
    runTick: jest.fn(async () => undefined),
    recover: jest.fn(async () => undefined),
    shutdown: jest.fn(async () => undefined)
  }
}

// The two ends of the link between the threads; only what a worker message may carry crosses it
function threadLink() {
  let toEngine: (message: ControlMessage) => void = () => undefined
  let toApi: (message: EngineMessage) => void = () => undefined
  const engineSide: MessageChannel<ControlMessage, EngineMessage> = {
    post: (message) => toApi(structuredClone(message)),
    onMessage: (handler) => void (toEngine = handler)
  }
  const apiSide: MessageChannel<EngineMessage, ControlMessage> = {
    post: (message) => toEngine(structuredClone(message)),
    onMessage: (handler) => void (toApi = handler)
  }

  return { engineSide, apiSide }
}

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }

describe('the trace over the link between the API thread and the engine thread', () => {
  function setup() {
    const traced = testTelemetry()
    const { tracing } = traced.telemetry
    const seen: Array<string | undefined> = []
    const { engineSide, apiSide } = threadLink()
    const core = fakeCore(tracing, seen)
    const host = new EngineHost(
      core as unknown as EngineCore,
      engineSide,
      logger,
      100,
      { now: () => 0, after: () => () => undefined },
      undefined,
      tracing
    )
    const port = new ChannelEnginePort(apiSide, tracing)

    return { traced, tracing, seen, core, host, port, engineSide }
  }

  it('continues the trace of the request in the engine, with a client span and a server span', async () => {
    const { traced, tracing, seen, port } = setup()

    const traceId = await tracing.withSpan('POST /manual', { kind: 'server' }, async (request) => {
      await expect(port.manual('u', 'b', 'move', [])).resolves.toEqual({ ok: true })
      return request.context?.traceId
    })

    expect(seen).toEqual([traceId])
    const byName = Object.fromEntries(traced.spans().map((span) => [`${span.name}/${span.kind}`, span]))
    const client = byName['engine manual/2']
    const server = byName['engine manual/1']
    expect(client.parentSpanContext?.spanId).toBe(byName['POST /manual/1'].spanContext().spanId)
    expect(server.parentSpanContext?.spanId).toBe(client.spanContext().spanId)
    expect(new Set(traced.spans().map((span) => span.spanContext().traceId))).toEqual(new Set([traceId]))
  })

  it('marks the round trip as failed when the engine answers with an error, and when the engine is gone', async () => {
    const { traced, tracing, port } = setup()

    await tracing.withSpan('request', {}, async () => {
      await expect(port.kill('u', 'e')).rejects.toMatchObject({ statusCode: 404 })
    })
    const client = traced.spans().find((span) => span.name === 'engine kill' && span.kind === 2)
    expect(client?.status.code).toBe(2)

    const gone = setup()
    const pending = gone.port.metrics()
    gone.port.abandon()
    await expect(pending).rejects.toThrow()
    const abandoned = gone.traced.spans().find((span) => span.name === 'engine metrics')
    expect(abandoned?.status.code).toBe(2)
  })

  it('ends the span of a request that could not be sent', async () => {
    const traced = testTelemetry()
    const port = new ChannelEnginePort(
      {
        post: () => {
          throw new Error('thread is gone')
        },
        onMessage: () => undefined
      },
      traced.telemetry.tracing
    )

    await expect(port.metrics()).rejects.toThrow('thread is gone')

    expect(traced.spans().map((span) => [span.name, span.status.code])).toEqual([['engine metrics', 2]])
  })

  it('gives the events the trace they were raised in, and the listeners work inside it', () => {
    const { traced, tracing, port, engineSide } = setup()
    const sink = new ChannelSink(engineSide, tracing)
    const heard: Array<string | undefined> = []
    port.onEvent(() => void heard.push(tracing.current()?.traceId))
    const event: EngineEvent = { type: 'execution', userId: 'u', execution: {} as never }

    const traceId = tracing.withSpan('engine.tick', { isRoot: true }, (tick) => {
      sink.emit(event)
      return tick.context?.traceId
    })
    sink.emit(event)

    expect(heard[0]).toBe(traceId)
    expect(heard[1]).toBeDefined()
    expect(heard[1]).not.toBe(traceId)
    expect(traced.spans().filter((span) => span.name === 'engine event execution')).toHaveLength(2)
  })

  it('sends no trace context when tracing is not wired, and everything still works', async () => {
    const { engineSide, apiSide } = threadLink()
    const posted: unknown[] = []
    const core = fakeCore(testTelemetry().telemetry.tracing, [])
    new EngineHost(core as unknown as EngineCore, engineSide, logger, 100, {
      now: () => 0,
      after: () => () => undefined
    })
    const port = new ChannelEnginePort({
      post: (message) => {
        posted.push(message)
        apiSide.post(message)
      },
      onMessage: (handler) => apiSide.onMessage(handler)
    })

    await expect(port.manual('u', 'b', 'move', [])).resolves.toEqual({ ok: true })

    expect(posted[0]).toMatchObject({ kind: 'request', traceparent: undefined })
    await expect(new DisabledEnginePort().metrics()).rejects.toThrow()
  })
})

describe('the trace over the Redis link between an API node and the engine node', () => {
  async function setup() {
    const traced = testTelemetry()
    const { tracing } = traced.telemetry
    const bus = new RedisBus()
    const seen: Array<string | undefined> = []
    const core = fakeCore(tracing, seen)
    const engine = { manual: () => core.manual(), kill: () => core.kill() }
    await new RedisEngineBridge(engine as never, bus.connection(), bus.connection(), logger, tracing).open()
    const port = new RedisEnginePort(bus.connection(), bus.connection(), 200, tracing)
    await port.open()

    return { traced, tracing, seen, port }
  }

  it('carries the trace of the API node to the engine node, with a client span and a server span', async () => {
    const { traced, tracing, seen, port } = await setup()

    const traceId = await tracing.withSpan('POST /manual', { kind: 'server' }, async (request) => {
      await expect(port.manual('u', 'b', 'move', [])).resolves.toEqual({ ok: true })
      return request.context?.traceId
    })

    expect(seen).toEqual([traceId])
    const client = traced.spans().find((span) => span.name === 'engine manual' && span.kind === 2)
    const server = traced.spans().find((span) => span.name === 'engine manual' && span.kind === 1)
    expect(server?.parentSpanContext?.spanId).toBe(client?.spanContext().spanId)
    expect(server?.spanContext().traceId).toBe(traceId)
    port.close()
  })

  it('marks the round trip as failed when the engine answers with an error', async () => {
    const { traced, tracing, port } = await setup()

    await tracing.withSpan('request', {}, async () => {
      await expect(port.kill('u', 'e')).rejects.toMatchObject({ statusCode: 404 })
    })

    expect(traced.spans().find((span) => span.name === 'engine kill' && span.kind === 2)?.status.code).toBe(2)
    port.close()
  })

  it('fails the round trip at once when no engine node listens, and when it does not answer in time', async () => {
    const traced = testTelemetry()
    const bus = new RedisBus()
    const port = new RedisEnginePort(bus.connection(), bus.connection(), 20, traced.telemetry.tracing)
    await port.open()

    await expect(port.metrics()).rejects.toThrow()

    const silent = new RedisBus()
    const listening = silent.connection()
    listening.on('messageBuffer', () => undefined)
    await listening.subscribe('botrts:engine:requests')
    const slow = new RedisEnginePort(silent.connection(), silent.connection(), 20, traced.telemetry.tracing)
    await slow.open()
    await expect(slow.metrics()).rejects.toThrow()
    const pending = slow.top(1)
    slow.close()
    await expect(pending).rejects.toThrow()

    const failed = traced.spans().filter((span) => span.name.startsWith('engine ') && span.status.code === 2)
    expect(failed.map((span) => span.status.message)).toEqual([
      'no engine node is listening',
      'the engine did not answer in time',
      'the link was closed'
    ])
  })
})
