import { importCandidates, importsOf } from './module-path'

describe('importCandidates', () => {
  it('resolves a relative path against the importing file, trying the extensions when there is none', () => {
    expect(importCandidates('/memory/main.js', './lib/util')).toEqual([
      '/memory/lib/util',
      '/memory/lib/util.js',
      '/memory/lib/util.ts',
      '/memory/lib/util.json'
    ])
  })

  it('takes a path with an extension as it is', () => {
    expect(importCandidates('/memory/a/main.ts', '../data.json')).toEqual(['/memory/data.json'])
    expect(importCandidates('/memory/main.js', './x/./y.js')).toEqual(['/memory/x/y.js'])
  })

  it.each(['lodash', '/other/x.js', 'https://example.com/x.js', ''])('refuses "%s"', (specifier) => {
    expect(() => importCandidates('/memory/main.js', specifier)).toThrow('only relative paths')
  })

  it('refuses to leave the drive and to import from something that is no drive file', () => {
    expect(() => importCandidates('/memory/main.js', '../other/x.js')).toThrow('leaves the drive')
    expect(() => importCandidates('main.js', './x.js')).toThrow('not a file of a drive')
  })
})

describe('importsOf', () => {
  it('finds static imports and re-exports, with and without bindings', () => {
    const source = [
      "import a from './a'",
      'import { b, c } from "./b.js";',
      "import * as d from './d'",
      "import './side'",
      "export { e } from './e'",
      "export * from './f'",
      "const text = 'import x from ./nope'",
      'export function main() {}'
    ].join('\n')

    expect(importsOf(source)).toEqual(['./a', './b.js', './d', './side', './e', './f'])
  })

  it('finds nothing in a file without imports', () => {
    expect(importsOf('export const x = 1')).toEqual([])
  })
})
