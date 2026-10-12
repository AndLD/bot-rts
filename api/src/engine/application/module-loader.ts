import { createHash } from 'crypto'
import { NotFoundError, ValidationError } from '../../shared/domain/errors'
import { ModuleLimits } from '../domain/engine-config'
import { ScriptLoadError } from '../domain/engine.errors'
import { importCandidates, importsOf } from '../domain/module-path'
import { ScriptSource } from './engine-ports'
import { Transpiler } from './transpiler'

type Owner = { userId: string; botId: string }

// The files an execution runs: the entry file as JavaScript, and with everything it imports (itself included) by path
export interface LoadedScript {
  readonly source: string
  readonly modules: ReadonlyMap<string, string>
}

// Resolves the module graph of an execution when it starts (design §10.1.1): reads the entry file and the files it imports
// from the drives of the bot, transpiles TypeScript (cached by content hash), turns JSON into modules, and keeps to the limits.
export class ModuleLoader {
  // Transpiled output by the hash of the file name and content; the oldest entry goes first
  private readonly cache = new Map<string, string>()

  constructor(
    private readonly source: ScriptSource,
    private readonly transpiler: Transpiler,
    private readonly limits: ModuleLimits
  ) {}

  async load(userId: string, botId: string, entry: string): Promise<LoadedScript> {
    const owner = { userId, botId }
    const modules = new Map<string, string>()
    await this.visit(owner, [entry], await this.source.read(userId, botId, entry), modules)
    return { source: modules.get(entry) as string, modules }
  }

  // `chain` is the path of imports that led here, entry first: its length is the depth, and a repeated file is a cycle
  private async visit(owner: Owner, chain: string[], text: string, modules: Map<string, string>) {
    const path = chain[chain.length - 1]
    if (Buffer.byteLength(text) > this.limits.maxFileBytes) {
      throw new ScriptLoadError(`${path} is larger than ${this.limits.maxFileBytes} bytes`)
    }
    const code = this.compile(path, text)
    modules.set(path, code)
    if (modules.size > this.limits.maxFiles) {
      throw new ScriptLoadError(`The script uses more than ${this.limits.maxFiles} files`)
    }
    for (const specifier of importsOf(code)) {
      const target = await this.resolve(owner, path, specifier)
      if (chain.includes(target.path)) {
        throw new ScriptLoadError(`Cyclic import: ${[...chain, target.path].join(' -> ')}`)
      }
      if (chain.length > this.limits.maxDepth) {
        throw new ScriptLoadError(`The imports are nested deeper than ${this.limits.maxDepth} levels`)
      }
      if (!modules.has(target.path)) {
        await this.visit(owner, [...chain, target.path], target.text, modules)
      }
    }
  }

  // The first candidate path that is a file, with its content
  private async resolve(owner: Owner, importer: string, specifier: string) {
    for (const path of importCandidates(importer, specifier)) {
      try {
        return { path, text: await this.source.read(owner.userId, owner.botId, path) }
      } catch (error) {
        // A path no file can have (a name the drive refuses) is as good as a missing file
        if (!(error instanceof NotFoundError || error instanceof ValidationError)) {
          throw error
        }
      }
    }
    throw new ScriptLoadError(`Cannot find "${specifier}" imported by ${importer}`)
  }

  private compile(path: string, text: string): string {
    if (path.endsWith('.json')) {
      try {
        JSON.parse(text)
      } catch {
        throw new ScriptLoadError(`${path} is not valid JSON`)
      }
      return `export default ${text}`
    }
    if (!path.endsWith('.ts')) {
      return text
    }
    const key = createHash('sha256').update(path).update('\0').update(text).digest('hex')
    const cached = this.cache.get(key)
    if (cached !== undefined) {
      return cached
    }
    const code = this.transpiler.toJavaScript(text, path)
    this.cache.set(key, code)
    if (this.cache.size > this.limits.cacheEntries) {
      this.cache.delete(this.cache.keys().next().value as string)
    }
    return code
  }
}
