import { parseCommandLine } from './command-line'

describe('parseCommandLine', () => {
  it('splits a line into the command and its arguments', () => {
    expect(parseCommandLine('  cd   scripts/lib ')).toEqual({ name: 'cd', args: ['scripts/lib'] })
    expect(parseCommandLine('help')).toEqual({ name: 'help', args: [] })
  })

  it('keeps quoted text together', () => {
    expect(parseCommandLine('edit "my notes.txt" x')).toEqual({ name: 'edit', args: ['my notes.txt', 'x'] })
    expect(parseCommandLine('edit ""')).toEqual({ name: 'edit', args: [''] })
  })

  it('has no command in an empty line', () => {
    expect(parseCommandLine('')).toBeNull()
    expect(parseCommandLine('   ')).toBeNull()
  })
})
