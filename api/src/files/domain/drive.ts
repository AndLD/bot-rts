import { Module } from '../../modules/domain/module.entity'

// The size of a class-1 memory module (design §11.4); the module's own `quota` property overrides it
export const DEFAULT_DRIVE_QUOTA_BYTES = 64 * 1024

export function isDrive(module: Module): boolean {
  return module.type === 'drive'
}

export function quotaOf(drive: Module): number {
  const quota = Number(drive.props.quota)
  return Number.isFinite(quota) && quota >= 0 ? quota : DEFAULT_DRIVE_QUOTA_BYTES
}

// A broken memory module makes every file on it inaccessible (design §8.4.1)
export function isWorking(drive: Module): boolean {
  return drive.condition > 0
}

// The name `cd` takes: the module name, numbered when a bot carries several modules of the same name
export function driveNames(drives: readonly Module[]): Map<string, string> {
  const seen = new Map<string, number>()
  const names = new Map<string, string>()

  for (const drive of drives) {
    const count = (seen.get(drive.name) ?? 0) + 1
    seen.set(drive.name, count)
    names.set(drive.id, count === 1 ? drive.name : `${drive.name}-${count}`)
  }
  return names
}
