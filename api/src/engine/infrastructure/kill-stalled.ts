import { EngineEvent } from '../application/engine-ports'
import { ExecutionRepository } from '../application/execution.repository'
import { ExecutionStatus } from '../domain/execution'

// What the supervisor does for the script that held the engine thread: the record says it was killed, so that the next engine does
// not start it again, and its player is told why
export async function killStalled(
  executions: ExecutionRepository,
  announcer: { announce(event: EngineEvent): void },
  executionId: string
): Promise<void> {
  const record = await executions.findById(executionId)
  if (!record || record.status !== ExecutionStatus.ACTIVE) {
    return
  }
  const reason = 'stalled the engine'
  await executions.update({ ...record, status: ExecutionStatus.KILLED, reason, endedAt: new Date() })
  announcer.announce({
    type: 'log',
    executionId,
    botId: record.botId,
    userId: record.userId,
    kind: 'error',
    text: `killed: the script ${reason}`
  })
}
