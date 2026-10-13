import { ITerminalCwd } from '@lib/utils/interfaces/terminal'

export const DEFAULT_PREFIX = '/>'
export const SHELL_PREFIX = '>>>'

export interface TerminalSession {
  isShellMode: boolean
}

// What the terminal has to do for a line of input; the interpreter only decides, the hook performs it. Everything
// but the screen and the shell mode is answered by the server, which knows the drives, the files and the bots.
export type TerminalAction =
  | { type: 'none' }
  | { type: 'clear' }
  | { type: 'enter-shell' }
  | { type: 'exit-shell' }
  | { type: 'help'; topic: string }
  | { type: 'send'; line: string }

export function getPrefix(session: { isShellMode: boolean; cwd: ITerminalCwd }): string {
  if (session.isShellMode) {
    return SHELL_PREFIX
  }

  const { drive, directory } = session.cwd
  return drive ? `/${directory ? `${drive}/${directory}` : drive}>` : DEFAULT_PREFIX
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Output lines are rendered as HTML, so every piece of dynamic text is escaped before it is joined with line breaks
export function joinLines(lines: string[]): string {
  return lines.map(escapeHtml).join('</br>')
}

export function interpret(input: string, session: TerminalSession): TerminalAction {
  const command = input.trim()

  if (command === '') {
    return { type: 'none' }
  }
  if (command === 'clear') {
    return { type: 'clear' }
  }
  if (session.isShellMode) {
    // Anything but `exit` is a line of code, run by the server with the bot in scope
    return command === 'exit' ? { type: 'exit-shell' } : { type: 'send', line: `eval ${command}` }
  }

  if (command === 'shell') {
    return { type: 'enter-shell' }
  }
  // `help` alone is answered by the server with the list of commands; `help <topic>` opens a page of the documentation
  const topic = /^help\s+(\S.*)$/.exec(command)?.[1]

  return topic ? { type: 'help', topic } : { type: 'send', line: command }
}
