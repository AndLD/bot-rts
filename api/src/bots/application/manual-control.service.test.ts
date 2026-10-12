import { ManualControlService } from './manual-control.service'

describe('ManualControlService', () => {
  it('hands the action to the engine and returns its answer', async () => {
    const engine = { manual: jest.fn().mockResolvedValue({ ok: true }) }

    const answer = await new ManualControlService(engine).perform('u', 'b', 'drop', [1, 2])

    expect(answer).toEqual({ ok: true })
    expect(engine.manual).toHaveBeenCalledWith('u', 'b', 'drop', [1, 2])
  })
})
