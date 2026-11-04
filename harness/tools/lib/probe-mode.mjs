// How a migration handles the probes (report 65): taking a version asks a project to rerun the probes whose areas the version touched, each as a session of
// its own that reads thousands of words, for every release. `probes.run` of the profile file is the project's choice (`auto`, `ask`, the default, or
// `disabled`), and the ignored `harness-profile.local.json` overrides it on one machine. There is no runner yet, so no command starts a probe itself: `migrate`
// and `harness probes` say at the end of their output what the mode asks of whoever takes the version, and the procedure `update-framework` follows the same.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LOCAL_OVERRIDE_FILE } from './reports.mjs'

export const PROBE_MODES = Object.freeze(['auto', 'ask', 'disabled'])
export const DEFAULT_PROBE_MODE = 'ask'

/**
 * The mode that applies now: `probes.run` of the profile file, overridden by the same key of the local file. A value that is not valid is ignored, and said.
 * @returns {{ mode: 'auto' | 'ask' | 'disabled', notes: string[] }}
 */
export function probeMode({ profile, root }) {
  const notes = []
  let mode = DEFAULT_PROBE_MODE
  const set = (value, where) => {
    if (value === undefined) return
    if (PROBE_MODES.includes(value)) mode = value
    else notes.push(`${where}: probes.run "${value}" is not one of ${PROBE_MODES.join(', ')} and is ignored`)
  }
  set(profile?.probes?.run, 'the profile file')
  const path = root ? join(root, LOCAL_OVERRIDE_FILE) : null
  if (path && existsSync(path)) {
    try {
      set(JSON.parse(readFileSync(path, 'utf8')).probes?.run, LOCAL_OVERRIDE_FILE)
    } catch {
      notes.push(`${LOCAL_OVERRIDE_FILE}: not valid JSON, so it is ignored`)
    }
  }
  return { mode, notes }
}

/** The lines at the end of the output of a migration or of `harness probes`: what the mode asks for the versions `from` to `to`. */
export function probeAdvice({ mode, notes = [], from, to }) {
  const list = `\`harness probes ${from} ${to}\``
  const asked = {
    auto: `Probes (probes.run is auto): run the probes ${list} lists now, each as a separate session started in this repository, and report what each read against the last review. No command starts them yet.`,
    ask: `Probes (probes.run is ask): do not run them yet. Ask the owner whether to run the probes of this version, and run what ${list} lists, each as a separate session, only on a yes. Where nobody can be asked, treat the mode as disabled.`,
    disabled: `Probes (probes.run is disabled): not run. To check what this version did to an agent anyway, run what ${list} lists, each as a separate session started in this repository.`
  }
  return [...notes, asked[mode]]
}
