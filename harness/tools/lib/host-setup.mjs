// The host setup of a new project (the bootstrap, task 3.18): the bootstrap asks the host what it offers for this repository, and sets the
// profile file's `host.protection` to the answer before the files are written (a workflow that keeps pull requests up to date exists only where
// the host protects), then, where it can, applies the protection and the auto-merge setting. Four cases, each said in a line:
//   - the host can protect the repository and the user administers it: the protection is applied (after a question, in an interactive run);
//   - the host can protect it and the user has no admin rights: the files are written and the one command for the owner is named;
//   - the host cannot (a private repository on a free plan): `host.protection` is false, and one line says what going public or a paid plan adds;
//   - the host cannot be asked (no network, no such repository yet): nothing is changed, and the command is named for later.
// A value the profile file has set already is the owner's: nothing is asked or changed then. `--no-host-setup` skips the whole step.
import { selectedAdapters } from './lock.mjs'

const hostCommand = (profile, harness) => `node ${harness} host protect`

/**
 * Decides the host setup of `profile` from the answer of the host adapter.
 * @param {{ profile: object, adapter: object, harness: string, cli?: Function, confirm?: (question: string) => Promise<boolean> }} options
 *   `adapter` is the host adapter as the bootstrap loaded it; `confirm` asks the user once in an interactive run
 * @returns {Promise<{ profile: object, apply: boolean, messages: string[] }>} `profile` has `host.protection` set; `apply` says to run `protect` after the files are written
 */
export async function decideHostSetup({ profile, adapter, harness, cli, confirm }) {
  const entry = (role) => adapter?.manifest.roles[role]
  const detect = entry('protection-available')?.module
    ? adapter.modules[entry('protection-available').module]?.[entry('protection-available').export]
    : undefined
  const protect = entry('branch-protection')?.module
    ? adapter.modules[entry('branch-protection').module]?.[entry('branch-protection').export]
    : undefined
  if (!detect || !protect || profile.host?.protection !== undefined) {
    return { profile, apply: false, messages: [] }
  }
  const slug = profile.repository?.slug
  const command = hostCommand(profile, harness)
  const withProtection = (protection) => ({ ...profile, host: { ...profile.host, protection } })

  let detected
  try {
    detected = detect({ slug, ...(cli ? { cli } : {}) })
  } catch (error) {
    return {
      profile,
      apply: false,
      messages: [
        `Host setup skipped: the host could not be asked (${error.message}). Once ${slug} exists on the host and you administer it, run: ${command}`
      ]
    }
  }
  if (!detected.available) {
    return {
      profile: withProtection(false),
      apply: false,
      messages: [
        `Host setup: ${detected.reason}, so host.protection is false: the Git hooks and the hooks of the agent runtime hold the branch rules, and agents ask before they merge (auto-merge is off). Making the repository public, or a paid plan, adds the ruleset and auto-merge: then set host.protection to true and run: ${command}`
      ]
    }
  }
  if (detected.admin === false) {
    return {
      profile: withProtection(true),
      apply: false,
      messages: [
        `Host setup: the host can protect ${slug}, but you do not administer it, so nothing was set. The files are written; ask an owner of the repository to run: ${command}`
      ]
    }
  }
  const will = `the ruleset on the production and the integration branch, "allow auto-merge" on, and "delete head branches" off in ${slug}`
  if (confirm && !(await confirm(`Set ${will}? [Y/n] `))) {
    return {
      profile: withProtection(true),
      apply: false,
      messages: [`Host setup: not applied, as you answered. To set it later, run: ${command}`]
    }
  }
  return { profile: withProtection(true), apply: true, messages: [`Host setup: setting ${will}.`] }
}

/** The adapter of the profile's host as the bootstrap's `modules` hold it, or undefined. */
export const hostAdapterOf = (profile, modules) => {
  const { host } = selectedAdapters(profile)
  return host ? modules.host[host] : undefined
}

/**
 * `profile` with `repository.url` from the host adapter's role `repository-address`, when the profile has none: without it `harness release` writes
 * `undefined` into the compare and tag links of the changelog. An address the profile file has is the owner's.
 */
export function withRepositoryUrl(profile, adapter) {
  const entry = adapter?.manifest.roles['repository-address']
  const repositoryUrl = entry?.module ? adapter.modules[entry.module]?.[entry.export] : undefined
  const slug = profile.repository?.slug
  if (!repositoryUrl || !slug || profile.repository.url) {
    return profile
  }
  return { ...profile, repository: { ...profile.repository, url: repositoryUrl({ slug }) } }
}
