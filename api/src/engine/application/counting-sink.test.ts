import { CountingSink } from './counting-sink'
import { EngineMetrics } from './engine-metrics'
import { EngineEvent } from './engine-ports'

describe('CountingSink', () => {
  it('hands every event on and counts it, the live-view pushes also on their own', () => {
    const metrics = new EngineMetrics()
    const seen: EngineEvent[] = []
    const sink = new CountingSink({ emit: (event) => void seen.push(event) }, metrics)
    const execution: EngineEvent = { type: 'execution', userId: 'u', execution: {} as never }
    const vision: EngineEvent = { type: 'vision', userId: 'u', botId: 'b', tick: 1, cells: [], isFull: true } as never

    sink.emit(execution)
    sink.emit(vision)
    sink.emit(vision)

    expect(seen).toHaveLength(3)
    expect(metrics.snapshot().counters).toEqual({ events: 3, visionDiffs: 2 })
  })
})
