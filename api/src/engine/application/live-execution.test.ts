import { Execution, ExecutionStatus } from '../domain/execution'
import { LiveExecution } from './live-execution'
import { FakeScript } from '../../../tests/fakes/engine'

const record: Execution = {
  id: 'e1',
  botId: 'b1',
  userId: 'u1',
  file: '/m/a.js',
  args: [],
  status: ExecutionStatus.ACTIVE,
  restarts: 0,
  reason: null,
  createdAt: new Date(0),
  endedAt: null
}

describe('LiveExecution', () => {
  it('is queued until it has run, then running, awaiting an answer or suspended in a sleep', () => {
    const script = new FakeScript()
    const live = new LiveExecution(record, script, 0)
    expect(live.view().state).toBe('queued')
    expect(live.isRunnable).toBe(true)

    script.calls = [{ callId: 1, fn: 'scan', args: [] }]
    const { commands } = live.step(1, 5, 100)
    expect(commands).toEqual([{ executionId: 'e1', botId: 'b1', callId: 1, fn: 'scan', args: [] }])
    expect(live.view().state).toBe('awaiting')
    expect(live.isRunnable).toBe(false)

    live.answer(1, { value: 4 }, 2)
    live.settle(2)
    expect(script.settled).toEqual(['resolve 1 4'])
    expect(live.view().state).toBe('running')

    script.calls = [{ callId: 2, fn: 'sleep', args: [250] }]
    expect(live.step(2, 5, 100).commands).toEqual([])
    expect(live.view().state).toBe('suspended')
    script.ready = true
    expect(live.view().state).toBe('running')
  })

  it('wakes a sleeper at its tick, never earlier, and sleeps at least one tick', () => {
    const script = new FakeScript()
    const live = new LiveExecution(record, script, 0)
    script.calls = [
      { callId: 1, fn: 'sleep', args: [0] },
      { callId: 2, fn: 'sleep', args: [250] }
    ]
    live.step(10, 5, 100)

    live.settle(10)
    expect(script.settled).toEqual([])
    live.settle(11)
    expect(script.settled).toEqual(['resolve 1 undefined'])
    live.settle(13)
    expect(script.settled).toEqual(['resolve 1 undefined', 'resolve 2 undefined'])
  })

  it('delivers an answer only from the tick it is due', () => {
    const script = new FakeScript()
    const live = new LiveExecution(record, script, 0)
    script.calls = [{ callId: 1, fn: 'move', args: [3] }]
    live.step(1, 5, 100)

    live.answer(1, { value: { moved: 3 } }, 5)
    live.settle(4)
    expect(script.settled).toEqual([])
    expect(live.view().state).toBe('awaiting')
    live.settle(5)
    expect(script.settled).toEqual(['resolve 1 {"moved":3}'])
  })

  it('rejects an invalid sleep as misuse', () => {
    const script = new FakeScript()
    const live = new LiveExecution(record, script, 0)
    script.calls = [
      { callId: 1, fn: 'sleep', args: [-5] },
      { callId: 2, fn: 'sleep', args: ['a'] }
    ]

    live.step(1, 5, 100)

    expect(script.settled).toEqual(['reject 1 sleep: ms must not be negative', 'reject 2 sleep: ms must be an integer'])
  })

  it('passes a misuse answer to the script as a rejection', () => {
    const script = new FakeScript()
    const live = new LiveExecution(record, script, 0)
    script.calls = [{ callId: 1, fn: 'scan', args: [] }]
    live.step(1, 5, 100)

    live.answer(1, { misuse: 'bad' }, 2)
    live.settle(2)

    expect(script.settled).toEqual(['reject 1 bad'])
  })

  it('exposes its record, memory and disposal', () => {
    const script = new FakeScript()
    const live = new LiveExecution(record, script, 3)

    live.update({ ...record, restarts: 2 })
    live.dispose()

    expect(live.record.restarts).toBe(2)
    expect(live.sinceTick).toBe(3)
    expect(live.memoryBytes()).toBe(5)
    expect(script.settled).toEqual(['disposed'])
  })
})
