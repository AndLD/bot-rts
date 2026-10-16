import { ENGINE_COUNTER, MetricRecorder } from './engine-metrics'
import { EngineEvent, EngineSink } from './engine-ports'

// Hands every event on and counts it: all of them, and the pushes of the live views separately (the console's events and diffs per second)
export class CountingSink implements EngineSink {
  constructor(
    private readonly inner: EngineSink,
    private readonly recorder: MetricRecorder
  ) {}

  emit(event: EngineEvent): void {
    this.recorder.count(ENGINE_COUNTER.events)
    if (event.type === 'vision') {
      this.recorder.count(ENGINE_COUNTER.visionDiffs)
    }
    this.inner.emit(event)
  }
}
