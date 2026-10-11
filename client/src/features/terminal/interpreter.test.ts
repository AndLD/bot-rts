import { DEFAULT_PREFIX, escapeHtml, getPrefix, interpret, joinLines, SHELL_PREFIX } from './interpreter'

const top = { drive: null, directory: null }

describe('getPrefix', () => {
  it('is the default prompt at the top', () => {
    expect(getPrefix({ isShellMode: false, cwd: top })).toBe(DEFAULT_PREFIX)
  })

  it('names the drive and the directory', () => {
    expect(getPrefix({ isShellMode: false, cwd: { drive: 'C', directory: null } })).toBe('/C>')
    expect(getPrefix({ isShellMode: false, cwd: { drive: 'C', directory: 'a/b' } })).toBe('/C/a/b>')
  })

  it('is the shell prompt in shell mode, wherever the session is', () => {
    expect(getPrefix({ isShellMode: true, cwd: { drive: 'C', directory: null } })).toBe(SHELL_PREFIX)
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
    expect(interpret('   ', { isShellMode: false })).toEqual({ type: 'none' })
  })

  it('clears the screen in any mode', () => {
    expect(interpret('clear', { isShellMode: false })).toEqual({ type: 'clear' })
    expect(interpret(' clear ', { isShellMode: true })).toEqual({ type: 'clear' })
  })

  it('enters the shell, and leaves it only with exit', () => {
    expect(interpret('shell', { isShellMode: false })).toEqual({ type: 'enter-shell' })
    expect(interpret('exit', { isShellMode: true })).toEqual({ type: 'exit-shell' })
    expect(interpret('1 + 1', { isShellMode: true })).toEqual({ type: 'none' })
  })

  it('leaves every other command to the server, trimmed', () => {
    expect(interpret('  cd  scripts ', { isShellMode: false })).toEqual({ type: 'send', line: 'cd  scripts' })
    expect(interpret('exit', { isShellMode: false })).toEqual({ type: 'send', line: 'exit' })
  })
})
