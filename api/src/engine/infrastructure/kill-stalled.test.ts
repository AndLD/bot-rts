import { InMemoryExecutionRepository } from '../../../tests/fakes/engine'
import { Execution, ExecutionStatus } from '../domain/execution'
import { killStalled } from './kill-stalled'

const record = (overrides: Partial<Execution> = {}): Execution => ({
  id: 'exec-1',
  botId: 'bot-1',
  userId: 'user-1',
  file: '/memory/main.js',
  args: [],
  status: ExecutionStatus.ACTIVE,
  restarts: 0,
  reason: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  endedAt: null,
  ...overrides
})

describe('killStalled', () => {
  it('records the script as killed and tells its player why', async () => {
    const executions = new InMemoryExecutionRepository()
    await executions.add(record())
    const announced: unknown[] = []

    await killStalled(executions, { announce: (event) => announced.push(event) }, 'exec-1')

    expect(executions.items.get('exec-1')).toMatchObject({
      status: ExecutionStatus.KILLED,
      reason: 'stalled the engine',
      endedAt: expect.any(Date)
    })
    expect(announced).toEqual([
      {
        type: 'log',
        executionId: 'exec-1',
        botId: 'bot-1',
        userId: 'user-1',
        kind: 'error',
        text: 'killed: the script stalled the engine'
      }
    ])
  })

  it('leaves an execution alone that is gone or already over', async () => {
    const executions = new InMemoryExecutionRepository()
    await executions.add(record({ status: ExecutionStatus.FINISHED }))
    const announced: unknown[] = []

    await killStalled(executions, { announce: (event) => announced.push(event) }, 'exec-1')
    await killStalled(executions, { announce: (event) => announced.push(event) }, 'missing')

    expect(executions.items.get('exec-1')?.status).toBe(ExecutionStatus.FINISHED)
    expect(announced).toEqual([])
  })
})
