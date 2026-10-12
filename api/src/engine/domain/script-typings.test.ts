import ts from 'typescript'
import { SCRIPT_FUNCTIONS } from '../../../../lib/utils/script-api'
import { scriptTypings } from '../../../../lib/utils/script-typings'

describe('scriptTypings', () => {
  const typings = scriptTypings()

  it('declares every function of the catalog as a method of Bot and as a global', () => {
    for (const { name } of SCRIPT_FUNCTIONS) {
      expect(typings).toContain(`\n  ${name}(`)
      expect(typings).toContain(`declare function ${name}(`)
    }
  })

  it('types arguments by their kind, marks the optional ones and types sleep as a promise of nothing', () => {
    expect(typings).toContain("  turn(direction: 'left' | 'right'): Promise<Result<any>>")
    expect(typings).toContain('  view(since?: number): Promise<Result<any>>')
    expect(typings).toContain('  assemble(label: string | null, partIds: string[]): Promise<Result<any>>')
    expect(typings).toContain('  sleep(ms: number): Promise<void>')
  })

  it('is valid TypeScript', () => {
    const { diagnostics } = ts.transpileModule(typings, { reportDiagnostics: true, fileName: 'bot.ts' })

    expect(diagnostics).toEqual([])
  })
})
