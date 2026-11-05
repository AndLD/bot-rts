// The executors of this runtime (contract role "executors"): how an orchestrator of a flow hands a step to a worker. Return `{ session?, subagent?, manual? }`;
// each executor is `{ means, wakeups, cacheMinutes, start(request), continue(request), report({ worker }), context({ worker }) }`, and each operation returns
// a list of means (`{ via, tool, input, reads? }`, `{ via, command, reads? }`, `{ via, from }` or `{ via, owner }`), empty when the runtime cannot do it. The
// request of `start` is `{ prompt, model, effort, cwd, name }`, that of `continue` `{ worker, prompt, model, effort, cwd }`; put `prompt` where the prompt goes.
// A runtime without automation returns `{ manual }` only (see the cursor preset), and the framework's manual executor stands in for the rest.
export function executorsFor(profile) {
  throw new Error('TODO: the executors of this runtime')
}
