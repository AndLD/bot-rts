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
