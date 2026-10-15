import { EnginePort } from '../../engine/application/engine-port'
import { LogBuffer } from '../../shared/application/log-buffer'
import { LogsService } from './logs.service'

describe('LogsService', () => {
  it('searches the buffer and reports the times in milliseconds', () => {
    const buffer = new LogBuffer(5)
    buffer.add({ at: new Date(2000), level: 'warn', message: 'slow thing', requestId: 'r1' })
    buffer.add({ at: new Date(3000), level: 'info', message: 'fine', requestId: null })
    const service = new LogsService(buffer, {} as EnginePort)

    expect(service.search({ level: 'warn' }, 10)).toEqual({
      lines: [{ at: 2000, level: 'warn', message: 'slow thing', requestId: 'r1' }],
      total: 1,
      capacity: 5
    })
  })

  it('takes the slow ticks from the engine', async () => {
    const slow = { tick: 9, durationMs: 150, intervalMs: 100, isCut: true, queuedExecutions: 1, deferredExecutions: 2 }
    const service = new LogsService(new LogBuffer(1), {
      metrics: async () => ({ slowTicks: [slow] })
    } as unknown as EnginePort)

    expect(await service.slowTicks()).toEqual([slow])
  })
})
