// The name `cd` takes: the module name, numbered when a bot carries several modules of the same name
export function driveNames(drives: readonly { id: string; name: string }[]): Map<string, string> {
  const seen = new Map<string, number>()
  const names = new Map<string, string>()

  for (const drive of drives) {
    const count = (seen.get(drive.name) ?? 0) + 1
    seen.set(drive.name, count)
    names.set(drive.id, count === 1 ? drive.name : `${drive.name}-${count}`)
  }
  return names
}

// Splits `/<drive>/<path on the drive>` as a script writes it into the drive and the path on it; null when the path does
// not start with the name of one of the drives or names no file on it
export function splitDrivePath<T extends { name: string }>(
  drives: readonly T[],
  path: string
): { drive: T; path: string } | null {
  const [, name, ...rest] = path.split('/')
  const drive = path.startsWith('/') ? drives.find((candidate) => candidate.name === name) : undefined
  return drive && rest.length && rest.every(Boolean) ? { drive, path: rest.join('/') } : null
}
