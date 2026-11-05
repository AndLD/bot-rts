// The lines of the session-start hook about the flows (task 5.4): a flow that is running, waits for the owner or is blocked, with its next step. They go by
// the State column, which is a cache, so the hook stays quick and asks Git for nothing; `harness flow status <n>` recomputes the state from the repository.
import { STEP_STATES } from './flows.mjs'

const OPEN_STATUSES = ['🟡', '⏸', '⛔']

// The first step that is not done and whose needs are, by the State column
function nextByColumn(steps) {
  const done = new Set(steps.filter((step) => step.state === '✅').map((step) => step.id))
  return steps.find((step) => step.state !== '✅' && step.needs.every((need) => done.has(need))) ?? null
}

/** One line per flow of `read` (`readFlowsOf`, or null) that is under way; none for a project without flows. */
export function flowSessionLines(read) {
  return (read?.flows ?? [])
    .filter((flow) => OPEN_STATUSES.includes(flow.status))
    .map((flow) => {
      const next = nextByColumn(flow.steps)
      const where = `${read.dir}/${flow.file}`
      const state = flow.status === '🟡' ? flow.status : `${flow.status} ${STEP_STATES[flow.status]}`
      const step = next
        ? `next step by the State column: ${next.id} [${next.kind}] ${next.scope}`
        : 'no step can start by the State column'
      return `Flow in progress: ${flow.number} — ${flow.title} (${where}), ${state}; ${step}. \`harness flow status ${flow.number}\` recomputes it from the repository; the procedure \`run-flow\` runs it only when the owner asks.`
    })
}
