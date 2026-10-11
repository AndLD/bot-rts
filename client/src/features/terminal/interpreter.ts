import { IBot } from '@lib/utils/interfaces/bots'
import { ModuleProps } from '@lib/utils/interfaces/modules'

export const DEFAULT_PREFIX = '/>'
export const SHELL_PREFIX = '>>>'

// A line of output: a message of ours (translated by the caller) or ready, HTML-escaped data
export type TerminalReply = { message: 'unknownCommand' | 'unknownPath' } | { html: string }

export interface TerminalSession {
  isShellMode: boolean
  driveNames: string[]
  selectedDriveName: string | null
}

// What the terminal has to do for a line of input; the interpreter only decides, the hook performs it
export type TerminalAction =
  | { type: 'none' }
  | { type: 'clear' }
  | { type: 'reply'; reply: TerminalReply }
  | { type: 'logout' }
  | { type: 'enter-shell' }
  | { type: 'exit-shell' }
  | { type: 'select-drive'; driveName: string | null }
  | { type: 'list-bots' }
  | { type: 'list-modules' }

export function getPrefix(session: Pick<TerminalSession, 'isShellMode' | 'selectedDriveName'>): string {
  if (session.isShellMode) {
    return SHELL_PREFIX
  }

  return session.selectedDriveName ? `/${session.selectedDriveName}>` : DEFAULT_PREFIX
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

  return session.isShellMode ? interpretShellCommand(command) : interpretDefaultCommand(command, session)
}

function interpretShellCommand(command: string): TerminalAction {
  // Anything but `exit` would be executed as a line of code once the script runtime exists
  return command === 'exit' ? { type: 'exit-shell' } : { type: 'none' }
}

function interpretDefaultCommand(command: string, session: TerminalSession): TerminalAction {
  switch (command) {
    case 'ls':
    case 'dir':
      // Listing the files of a drive is not available yet
      return session.selectedDriveName
        ? { type: 'none' }
        : { type: 'reply', reply: { html: joinLines(session.driveNames) } }
    case 'shell':
      return { type: 'enter-shell' }
    case 'exit':
      return { type: 'logout' }
    case 'list':
      return { type: 'list-bots' }
    case 'modules':
      return { type: 'list-modules' }
  }

  const [name, path, ...rest] = command.split(/\s+/)

  if (name === 'cd' && path && !rest.length) {
    return interpretChangeDrive(path, session)
  }

  return { type: 'reply', reply: { message: 'unknownCommand' } }
}

function interpretChangeDrive(path: string, session: TerminalSession): TerminalAction {
  if (path === '..') {
    return { type: 'select-drive', driveName: null }
  }

  const driveName = path.startsWith('../') ? path.slice(3) : path

  return session.driveNames.includes(driveName)
    ? { type: 'select-drive', driveName }
    : { type: 'reply', reply: { message: 'unknownPath' } }
}

export function formatBots(bots: IBot[], currentBotId: string | null): string {
  return joinLines(
    bots.map((bot) => {
      const label = bot.label ? ` label="${bot.label}"` : ''
      return `${bot._id === currentBotId ? '(current)' : '-'} id="${bot._id}"${label} type="${bot.type}"`
    })
  )
}

export function formatModules(modules: ModuleProps[]): string {
  return joinLines(modules.map((module) => `- id="${module._id}" type="${module.type}" name="${module.name}"`))
}
