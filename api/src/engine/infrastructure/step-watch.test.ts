import { createStepWatchBuffer, StepWatchReader, StepWatchWriter } from './step-watch'

describe('the step watch', () => {
  const id = '3f2b8c1e-7d4a-4e9b-9c55-0a1b2c3d4e5f'

  it('shows the execution being stepped, and nothing between steps', () => {
    const buffer = createStepWatchBuffer()
    const writer = new StepWatchWriter(buffer)
    const reader = new StepWatchReader(buffer)

    expect(reader.read()).toEqual({ sequence: 0, executionId: null })
    writer.begin(id)
    expect(reader.read()).toEqual({ sequence: 1, executionId: id })
    writer.end()
    expect(reader.read()).toEqual({ sequence: 2, executionId: null })
  })

  it('changes the sequence with every step, so that a new step is told from a stuck one', () => {
    const buffer = createStepWatchBuffer()
    const writer = new StepWatchWriter(buffer)
    const reader = new StepWatchReader(buffer)

    writer.begin(id)
    const first = reader.read().sequence
    writer.end()
    writer.begin(id)

    expect(reader.read().sequence).not.toBe(first)
  })

  it('forgets a step whose thread is gone, and leaves an idle watch as it is', () => {
    const buffer = createStepWatchBuffer()
    const writer = new StepWatchWriter(buffer)
    const reader = new StepWatchReader(buffer)

    writer.begin(id)
    reader.clear()
    expect(reader.read()).toEqual({ sequence: 2, executionId: null })
    reader.clear()
    expect(reader.read().sequence).toBe(2)
  })

  it('shows a shorter id without the rest of the one before', () => {
    const buffer = createStepWatchBuffer()
    const writer = new StepWatchWriter(buffer)
    const reader = new StepWatchReader(buffer)

    writer.begin(id)
    writer.end()
    writer.begin('short')

    expect(reader.read().executionId).toBe('short')
  })
})
