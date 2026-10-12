// A line typed in the terminal's shell mode runs as an execution of its own (design §10.1): the line is the first argument of an
// execution of this pseudo file, and the engine turns it into the source of a script. Keeping the line in the execution record
// means a relaunch after an engine restart can rebuild it.
export const SHELL_FILE = '<shell>'

// What a line starting with one of these is: statements, not an expression whose value is shown
const STATEMENT = /^(const|let|var|if|for|while|do|switch|try|throw|function|class|return|async\s+function)\b|^\{|;\s*$/

// The source of the script a shell line runs as, with `bot` in scope
export function shellSource(line: string): string {
  const body = STATEMENT.test(line.trim()) ? line : `return (${line}\n)`
  return `export async function main(bot) {\n${body}\n}`
}
