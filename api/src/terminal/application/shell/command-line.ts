export interface ParsedCommand {
  readonly name: string
  readonly args: string[]
  // The line after the command name, as typed
  readonly rest: string
}

// Splits a typed line into the command and its arguments; double quotes keep spaces inside one argument
export function parseCommandLine(line: string): ParsedCommand | null {
  const words = [...line.matchAll(/"([^"]*)"|(\S+)/g)].map((match) => match[1] ?? match[2])
  const [name, ...args] = words
  const rest = line.replace(/^\s*(?:"[^"]*"|\S+)\s*/, '').trimEnd()
  return name === undefined ? null : { name, args, rest }
}
