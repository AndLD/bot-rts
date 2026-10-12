import { SHELL_FILE, shellSource } from './shell-script'

describe('shellSource', () => {
  it('names a pseudo file that no drive can hold', () => {
    expect(SHELL_FILE).toBe('<shell>')
  })

  it('returns the value of an expression', () => {
    expect(shellSource('bot.id')).toBe('export async function main(bot) {\nreturn (bot.id\n)\n}')
  })

  it.each(['const x = 1', 'let y = 2; y', 'if (true) bot.log(1)', 'for (const m of bot.modules) {}', 'x = 1;'])(
    'runs %s as statements',
    (line) => {
      expect(shellSource(line)).toBe(`export async function main(bot) {\n${line}\n}`)
    }
  )
})
