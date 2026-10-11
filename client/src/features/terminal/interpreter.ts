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
    // Anything but `exit` would be executed as a line of code once the script runtime exists
    return command === 'exit' ? { type: 'exit-shell' } : { type: 'none' }
  }

  return command === 'shell' ? { type: 'enter-shell' } : { type: 'send', line: command }
}
