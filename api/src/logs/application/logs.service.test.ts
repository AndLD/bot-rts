import { EnginePort } from '../../engine/application/engine-port'
import { LogStore } from './log-store'
import { LogsService } from './logs.service'

const store = (): jest.Mocked<LogStore> => ({
  name: 'elasticsearch',
  search: jest.fn(async () => ({
    entries: [
      {
        at: new Date(2000),
        level: 'warn' as const,
        message: 'slow thing',
        requestId: 'r1',
        traceId: 't1',
        node: 'host:1',
        service: 'botrts-api'
      }
    ],
    total: 7,
    capacity: null
  })),
  nodes: jest.fn(async () => [{ id: 'host:1', services: ['botrts-api'] }])
})

describe('LogsService', () => {
  it('searches the store and reports the times in milliseconds, with the name of the store', async () => {
    const logs = store()
    const service = new LogsService(logs, {} as EnginePort)

    expect(await service.search({ level: 'warn' }, { limit: 10, offset: 0 })).toEqual({
      lines: [
        {
          at: 2000,
          level: 'warn',
          message: 'slow thing',
          requestId: 'r1',
          traceId: 't1',
          node: 'host:1',
          service: 'botrts-api'
        }
      ],
      total: 7,
      capacity: null,
      store: 'elasticsearch'
    })
    expect(logs.search).toHaveBeenCalledWith({ level: 'warn' }, { limit: 10, offset: 0 })
  })

  it('lists the nodes of the store', async () => {
    expect(await new LogsService(store(), {} as EnginePort).nodes()).toEqual([
      { id: 'host:1', services: ['botrts-api'] }
    ])
  })

  it('takes the slow ticks from the engine', async () => {
    const slow = { tick: 9, durationMs: 150, intervalMs: 100, isCut: true, queuedExecutions: 1, deferredExecutions: 2 }
    const service = new LogsService(store(), {
      metrics: async () => ({ slowTicks: [slow] })
    } as unknown as EnginePort)

    expect(await service.slowTicks()).toEqual([slow])
  })
})
