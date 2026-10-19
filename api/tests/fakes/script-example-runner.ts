import { JsonValue } from '../../src/engine/domain/json-value'
import { ScriptExecution } from '../../src/engine/application/script-runtime'

// How many scheduler rounds an example gets: a loop that never ends is stopped after this many
export const EXAMPLE_ROUNDS = 40

// Runs an example script until it ends, waits for nothing, or the rounds are used up, answering every game call from `answers`
// (a call without an answer gets `undefined`, which is what `sleep` resolves with). Returns the functions it called.
export function driveExample(
  execution: ScriptExecution,
  answers: Record<string, JsonValue | undefined>
): { status: string; called: string[] } {
  const called: string[] = []
  let status = 'waiting'

  for (let round = 0; round < EXAMPLE_ROUNDS && status === 'waiting'; round++) {
    const outcome = execution.step(50)
    status = outcome.status
    if (outcome.status === 'failed') {
      throw new Error(`${outcome.failure.code}: ${outcome.failure.message}`)
    }
    for (const call of execution.takeCalls()) {
      called.push(call.fn)
      execution.resolveCall(call.callId, answers[call.fn])
    }
  }

  return { status, called }
}
