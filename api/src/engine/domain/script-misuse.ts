// A script called the API wrongly: an unknown function, one its bot has no module for, or invalid arguments. Unlike an
// expected failure (a Result value) it throws inside the script and ends the execution (design §10.3).
export class ScriptMisuseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScriptMisuseError'
  }
}
