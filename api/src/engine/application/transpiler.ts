export const TRANSPILER = Symbol('Transpiler')

// Turns TypeScript into the JavaScript the sandbox runs (design §10.1.1). It only strips the types: there is no type check
// that could stop a script from running. Throws ScriptLoadError for code that does not parse.
export interface Transpiler {
  toJavaScript(source: string, fileName: string): string
}
