import { ValidationError } from '../../shared/domain/errors'
import { FakeScriptSource } from '../../../tests/fakes/engine'
import { ScriptLoadError } from '../domain/engine.errors'
import { ModuleLimits } from '../domain/engine-config'
import { SucraseTranspiler } from '../infrastructure/sucrase-transpiler'
import { ModuleLoader } from './module-loader'

const LIMITS: ModuleLimits = { maxFileBytes: 200, maxFiles: 4, maxDepth: 3, cacheEntries: 2 }

function setup(files: Record<string, string>, limits: Partial<ModuleLimits> = {}) {
  const source = new FakeScriptSource()
  Object.entries(files).forEach(([path, text]) => source.files.set(path, text))
  const transpiler = new SucraseTranspiler()
  const toJavaScript = jest.spyOn(transpiler, 'toJavaScript')
  const loader = new ModuleLoader(source, transpiler, { ...LIMITS, ...limits })
  return { loader, source, toJavaScript, load: (entry = '/m/main.js') => loader.load('u', 'b', entry) }
}

describe('ModuleLoader', () => {
  it('loads a lone file as it is', async () => {
    const { load } = setup({ '/m/main.js': 'export function main() {}' })

    const script = await load()

    expect(script.source).toBe('export function main() {}')
    expect([...script.modules]).toEqual([['/m/main.js', 'export function main() {}']])
  })

  it('follows relative imports, with or without an extension, once per file', async () => {
    const { load } = setup({
      '/m/main.js': "import { a } from './lib/a'\nimport { b } from './lib/b.js'\nexport function main() {}",
      '/m/lib/a.js': "import { b } from './b'\nexport const a = 1",
      '/m/lib/b.js': 'export const b = 2'
    })

    const script = await load()

    expect([...script.modules.keys()].sort()).toEqual(['/m/lib/a.js', '/m/lib/b.js', '/m/main.js'])
  })

  it('transpiles TypeScript, entry or imported, and turns JSON into a module', async () => {
    const { load } = setup({
      '/m/main.ts':
        "import { n } from './n'\nimport data from './data.json'\nexport async function main(bot: unknown) { return [n, data] }",
      '/m/n.ts': 'export const n: number = 1',
      '/m/data.json': '{"a": [1, 2]}'
    })

    const script = await load('/m/main.ts')

    expect(script.modules.get('/m/main.ts')).toContain('main(bot) { return [n, data] }')
    expect(script.modules.get('/m/n.ts')).toBe('export const n = 1')
    expect(script.modules.get('/m/data.json')).toBe('export default {"a": [1, 2]}')
  })

  it('transpiles a file once for the same content, and again when it changes', async () => {
    const { loader, source, toJavaScript } = setup({ '/m/a.ts': 'export const a: number = 1' })

    await loader.load('u', 'b', '/m/a.ts')
    await loader.load('u', 'b', '/m/a.ts')
    expect(toJavaScript).toHaveBeenCalledTimes(1)

    source.files.set('/m/a.ts', 'export const a: number = 2')
    await loader.load('u', 'b', '/m/a.ts')
    expect(toJavaScript).toHaveBeenCalledTimes(2)
  })

  it('forgets the oldest transpiled file beyond the cache size', async () => {
    const files = {
      '/m/1.ts': 'export const a: number = 1',
      '/m/2.ts': 'export const a: number = 2',
      '/m/3.ts': 'export const a: number = 3'
    }
    const { loader, toJavaScript } = setup(files)

    for (const path of Object.keys(files)) await loader.load('u', 'b', path)
    await loader.load('u', 'b', '/m/3.ts')
    await loader.load('u', 'b', '/m/1.ts')

    expect(toJavaScript).toHaveBeenCalledTimes(4)
  })

  it('rejects a missing import, naming it and the file that wants it', async () => {
    const { load } = setup({ '/m/main.js': "import './nothing'" })

    await expect(load()).rejects.toThrow('Cannot find "./nothing" imported by /m/main.js')
  })

  it('takes a path the drive refuses as a missing file', async () => {
    const { load, source } = setup({ '/m/main.js': "import './bad'" })
    jest.spyOn(source, 'read').mockImplementation(async (_u, _b, path) => {
      if (path === '/m/main.js') return "import './bad'"
      throw new ValidationError('Invalid path')
    })

    await expect(load()).rejects.toThrow('Cannot find "./bad"')
  })

  it('rejects an import that is not a relative path of the drive', async () => {
    const { load } = setup({ '/m/main.js': "import x from 'left-pad'" })

    await expect(load()).rejects.toBeInstanceOf(ScriptLoadError)
  })

  it('rejects a cycle', async () => {
    const { load } = setup({ '/m/main.js': "import './a'", '/m/a.js': "import './main'" })

    await expect(load()).rejects.toThrow('Cyclic import: /m/main.js -> /m/a.js -> /m/main.js')
  })

  it('rejects a file that is too big, too many files, and imports nested too deep', async () => {
    const big = setup({ '/m/main.js': 'x'.repeat(201) })
    await expect(big.load()).rejects.toThrow('/m/main.js is larger than 200 bytes')

    const wide = setup({ '/m/main.js': "import './a'\nimport './b'", '/m/a.js': '', '/m/b.js': '' }, { maxFiles: 2 })
    await expect(wide.load()).rejects.toThrow('more than 2 files')

    const deep = setup({
      '/m/main.js': "import './1'",
      '/m/1.js': "import './2'",
      '/m/2.js': "import './3'",
      '/m/3.js': "import './4'",
      '/m/4.js': ''
    })
    await expect(deep.load()).rejects.toThrow('nested deeper than 3 levels')
  })

  it('accepts imports exactly as deep as the limit', async () => {
    const { load } = setup({
      '/m/main.js': "import './1'",
      '/m/1.js': "import './2'",
      '/m/2.js': "import './3'",
      '/m/3.js': ''
    })

    await expect(load()).resolves.toBeDefined()
  })

  it('rejects JSON that does not parse, and TypeScript that does not parse', async () => {
    const json = setup({ '/m/main.js': "import './d.json'", '/m/d.json': '{oops' })
    await expect(json.load()).rejects.toThrow('/m/d.json is not valid JSON')

    const ts = setup({ '/m/main.ts': 'export function (' })
    await expect(ts.load('/m/main.ts')).rejects.toThrow(ScriptLoadError)
  })

  it('lets a failure to read the entry through', async () => {
    const { load } = setup({})

    await expect(load()).rejects.toMatchObject({ statusCode: 404 })
  })

  it('does not hide a failure to read an import that is not "missing"', async () => {
    const { load, source } = setup({ '/m/main.js': "import './a'" })
    jest.spyOn(source, 'read').mockImplementation(async (_u, _b, path) => {
      if (path === '/m/main.js') return "import './a'"
      throw new Error('disk on fire')
    })

    await expect(load()).rejects.toThrow('disk on fire')
  })
})
