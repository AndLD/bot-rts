import { SucraseTranspiler } from './sucrase-transpiler'

describe('SucraseTranspiler', () => {
  const transpiler = new SucraseTranspiler()

  it('strips the types and keeps the modules', () => {
    const code = transpiler.toJavaScript(
      "import { a } from './a'\nexport async function main(bot: Bot, n: number): Promise<void> { const x: string = a }",
      '/memory/main.ts'
    )

    expect(code).toContain("import { a } from './a'")
    expect(code).toContain('export async function main(bot, n) { const x = a }')
  })

  it('names the file when the code does not parse', () => {
    expect(() => transpiler.toJavaScript('export function (', '/memory/bad.ts')).toThrow(/^\/memory\/bad\.ts: /)
  })
})
