// The executors of this runtime (contract role "executors"): how an orchestrator of a flow hands a step to a worker. Return `{ session?, cli?, subagent?, manual? }`;
// each executor is `{ means, wakeups, cacheMinutes, start(request), continue(request), report({ worker }), context({ worker }) }`, and each operation returns
// a list of means (`{ via, tool, input, reads? }`, `{ via, command, reads? }`, `{ via, from }` or `{ via, owner }`), empty when the runtime cannot do it. The
// request of `start` is `{ prompt, model, effort, cwd, name }`, that of `continue` `{ worker, prompt, model, effort, cwd }`; put `prompt` where the prompt goes.
// A runtime without automation returns `{ manual }` only (see the cursor preset), and the framework's manual executor stands in for the rest. Session, cli and
// manual are an order, each the fallback of the one before (the runtime contract): offer `cli` only when the runtime has a command line that runs a worker.
export function executorsFor(profile) {
  throw new Error('TODO: the executors of this runtime')
}
