export interface ParsedCommand {
  readonly name: string
  readonly args: string[]
}

// Splits a typed line into the command and its arguments; double quotes keep spaces inside one argument
export function parseCommandLine(line: string): ParsedCommand | null {
  const words = [...line.matchAll(/"([^"]*)"|(\S+)/g)].map((match) => match[1] ?? match[2])
  const [name, ...args] = words
  return name === undefined ? null : { name, args }
}
