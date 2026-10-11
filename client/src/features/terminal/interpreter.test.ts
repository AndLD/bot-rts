import { BOT_TYPE, IBot } from '@lib/utils/interfaces/bots'
import {
  DEFAULT_PREFIX,
  escapeHtml,
  formatBots,
  formatModules,
  getPrefix,
  interpret,
  joinLines,
  SHELL_PREFIX,
  TerminalSession
} from './interpreter'

const session = (overrides: Partial<TerminalSession> = {}): TerminalSession => ({
  isShellMode: false,
  driveNames: ['C', 'D'],
  selectedDriveName: null,
  ...overrides
})

describe('getPrefix', () => {
  it('is the default prompt outside shell mode and drives', () => {
    expect(getPrefix(session())).toBe(DEFAULT_PREFIX)
  })

  it('names the selected drive', () => {
    expect(getPrefix(session({ selectedDriveName: 'C' }))).toBe('/C>')
  })

  it('is the shell prompt in shell mode, even with a drive selected', () => {
    expect(getPrefix(session({ isShellMode: true, selectedDriveName: 'C' }))).toBe(SHELL_PREFIX)
  })
})

describe('escapeHtml / joinLines', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml(`<a href="x">&</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;')
  })

  it('escapes every line and joins them with line breaks', () => {
    expect(joinLines(['<b>', 'c'])).toBe('&lt;b&gt;</br>c')
  })
})

describe('interpret', () => {
  it('ignores an empty line', () => {
    expect(interpret('   ', session())).toEqual({ type: 'none' })
  })

  it('clears the screen in any mode', () => {
    expect(interpret('clear', session())).toEqual({ type: 'clear' })
    expect(interpret(' clear ', session({ isShellMode: true }))).toEqual({ type: 'clear' })
  })

  describe('in the default mode', () => {
    it.each(['ls', 'dir'])('%s lists the drives', (command) => {
      expect(interpret(command, session())).toEqual({ type: 'reply', reply: { html: 'C</br>D' } })
    })

    it('does nothing for ls inside a drive (files are not available yet)', () => {
      expect(interpret('ls', session({ selectedDriveName: 'C' }))).toEqual({ type: 'none' })
    })

    it.each([
      ['shell', 'enter-shell'],
      ['exit', 'logout'],
      ['list', 'list-bots'],
      ['modules', 'list-modules']
    ])('%s is %s', (command, type) => {
      expect(interpret(command, session())).toEqual({ type })
    })

    it('goes up with cd ..', () => {
      expect(interpret('cd ..', session({ selectedDriveName: 'C' }))).toEqual({ type: 'select-drive', driveName: null })
    })

    it('selects a drive by name or by a ../ path', () => {
      expect(interpret('cd C', session())).toEqual({ type: 'select-drive', driveName: 'C' })
      expect(interpret('cd ../D', session())).toEqual({ type: 'select-drive', driveName: 'D' })
    })

    it('reports a path that is not a drive', () => {
      expect(interpret('cd Z', session())).toEqual({ type: 'reply', reply: { message: 'unknownPath' } })
    })

    it.each(['cd', 'cd C D', 'rm', 'ls -l'])('does not know "%s"', (command) => {
      expect(interpret(command, session())).toEqual({ type: 'reply', reply: { message: 'unknownCommand' } })
    })
  })

  describe('in shell mode', () => {
    it('leaves on exit', () => {
      expect(interpret('exit', session({ isShellMode: true }))).toEqual({ type: 'exit-shell' })
    })

    it('ignores any other input', () => {
      expect(interpret('list', session({ isShellMode: true }))).toEqual({ type: 'none' })
    })
  })
})

describe('formatBots', () => {
  const bots: IBot[] = [
    { _id: 'a', type: BOT_TYPE.BASE, label: 'home' },
    { _id: 'b', type: BOT_TYPE.WORKER }
  ]

  it('marks the current bot and shows labels', () => {
    expect(formatBots(bots, 'a')).toBe(
      '(current) id=&quot;a&quot; label=&quot;home&quot; type=&quot;base&quot;</br>- id=&quot;b&quot; type=&quot;worker&quot;'
    )
  })

  it('marks no bot as current when none is selected', () => {
    expect(formatBots(bots, null)).not.toContain('(current)')
  })

  it('escapes a hostile label', () => {
    expect(formatBots([{ _id: 'a', type: BOT_TYPE.BASE, label: '<img src=x>' }], null)).not.toContain('<img')
  })
})

describe('formatModules', () => {
  it('lists the id, type and name of each module', () => {
    const modules = [{ _id: 'm1', type: 'scanner', name: 'Scanner' }] as Parameters<typeof formatModules>[0]

    expect(formatModules(modules)).toBe('- id=&quot;m1&quot; type=&quot;scanner&quot; name=&quot;Scanner&quot;')
  })
})
