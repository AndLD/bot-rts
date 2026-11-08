// The quiet variants of a stack's commands (task 6.2's other half, task 6.3): the same check with its output reduced to the failures and a summary. A stack adapter
// gives them next to its commands (the role `quiet-commands`, in its `defaults.commands`), the profile file holds them as `commands.<name>Quiet`, and a procedure cites
// the quiet variant of a quality gate by that role. A project without one keeps working: its quiet variant is the plain command.

/** The quiet role of each command role that has one: `lintQuiet` is the quiet variant of `lint`. */
export const QUIET_ROLES = Object.freeze({
  lintQuiet: 'lint',
  typecheckQuiet: 'typecheck',
  formatQuiet: 'format',
  testQuiet: 'test',
  testCoverageQuiet: 'testCoverage'
})

/** The profile with every quiet role that is not set filled with the plain command, so a procedure that cites the quiet variant works in a project that has none. */
export function withQuietDefaults(profile) {
  const commands = { ...(profile?.commands ?? {}) }
  for (const [quiet, plain] of Object.entries(QUIET_ROLES)) {
    if (!commands[quiet] && commands[plain]) commands[quiet] = commands[plain]
  }
  return { ...profile, commands }
}

/** The quiet roles that a stack's `defaults.commands` should hold: those whose plain command it gives. */
export const quietRolesOf = (commands = {}) => Object.keys(QUIET_ROLES).filter((quiet) => commands[QUIET_ROLES[quiet]])
