// The host adapter of the project (design §4.3), as the tools use it: the module that fills a role, and `harness host protect`. The adapters
// present in this copy of the framework are loaded once, when this module is imported (a project's `harness/` holds the selected ones only).
import { loadHostAdapters } from './adapters.mjs'

export const HOSTS = await loadHostAdapters()

/** The module that fills `role` for the host the profile selects. An unknown host, or a role it does not fill, is an error naming what is missing. */
export function hostModule(profile, role, hosts = HOSTS) {
  const name = profile.adapters?.host
  if (!name) {
    throw new Error('the profile file selects no host adapter (adapters.host)')
  }
  const host = hosts[name]
  if (!host) {
    throw new Error(
      `the host adapter "${name}" is not in this copy of the framework; check adapters.host in the profile file`
    )
  }
  const entry = host.manifest.roles[role]
  if (!entry?.module) {
    throw new Error(`the host adapter "${name}" has no module for the role "${role}"`)
  }
  return host.modules[entry.module]
}

/**
 * `harness host protect`: the branch protection of the profile, applied through the host adapter.
 * @returns {{ messages: string[], problems: string[] }}
 */
export function protectHost({ profile, repo, cli }) {
  const { protect } = hostModule(profile, 'branch-protection')
  return protect({ profile, ...(repo ? { slug: repo } : {}), ...(cli ? { cli } : {}) })
}
