import { IResourceStack, RESOURCE } from '../../../../lib/utils/interfaces/resources'
import { fail, ok, Result, ResultCode } from '../../../../lib/utils/result'
import { StorageModule } from './game-module'
import { Module } from './module.entity'

// Rounds away the float noise of fractional amounts
const clean = (value: number) => Math.round(value * 1e6) / 1e6

// The working storages among the records; the resources of a bot are spread over them
function storagesOf(records: readonly Module[]): StorageModule[] {
  return records.filter((record) => record.type === 'storage').map((record) => new StorageModule(record))
}

// How much of a resource the bot holds in its working storages
export function stockOf(records: readonly Module[], resource: RESOURCE): number {
  return clean(
    storagesOf(records)
      .filter((storage) => storage.isWorking)
      .reduce((sum, storage) => sum + storage.amountOf(resource), 0)
  )
}

// Takes the stacks out of the storages, one storage after the other. All or nothing: the changed records, or EMPTY
// naming the first resource that is short.
export function withdrawStacks(records: readonly Module[], stacks: readonly IResourceStack[]): Result<Module[]> {
  let current = [...records]

  for (const { resource, amount } of stacks) {
    if (stockOf(current, resource) < amount) {
      return fail(ResultCode.EMPTY, `Not enough ${resource}`)
    }
    let left = amount
    for (const storage of storagesOf(current).filter((candidate) => candidate.isWorking)) {
      const taken = Math.min(storage.amountOf(resource), left)
      if (taken > 0) {
        const removed = storage.remove({ resource, amount: taken })
        if (removed.ok) {
          const changed = storage.withProps({ items: removed.data })
          current = current.map((record) => (record.id === changed.id ? changed : record))
          left = clean(left - taken)
        }
      }
    }
  }
  return ok(current.filter((record) => !records.includes(record)))
}
