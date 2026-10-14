import { AsyncLocalStorage } from 'async_hooks'

interface RequestContext {
  requestId: string
}

const storage = new AsyncLocalStorage<RequestContext>()

// Runs `work` with the id of the request, so that everything it logs can be tied to the request
export function runWithRequestId<T>(requestId: string, work: () => T): T {
  return storage.run({ requestId }, work)
}

export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId
}
