import { transform } from 'sucrase'
import { ScriptLoadError } from '../domain/engine.errors'
import { Transpiler } from '../application/transpiler'

// Type stripping with sucrase: fast, no type check, and the modules stay ES modules for the sandbox
export class SucraseTranspiler implements Transpiler {
  toJavaScript(source: string, fileName: string): string {
    try {
      return transform(source, { transforms: ['typescript'], disableESTransforms: true, filePath: fileName }).code
    } catch (error) {
      throw new ScriptLoadError(`${fileName}: ${(error as Error).message}`)
    }
  }
}
