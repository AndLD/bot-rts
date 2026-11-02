// The packaging of the neutral procedures for this runtime (contract role "procedure-packaging").
// `procedure` is `{ name, description, invocation: 'auto' | 'explicit', paths? }` and `body` its rendered text. Return the text of the file the runtime
// loads: it carries the name, the trigger (the description) and the steps, ends with a newline, and is the same on every run.
export function packageProcedure(procedure, body) {
  throw new Error('TODO: package a procedure for this runtime')
}
