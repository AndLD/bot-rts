// The node-ts adapter's role "dependency-audit" (stack contract): which files list the dependencies, which lock file each needs, the versions that are not
// pinned (probes S2-001 and S2-003 of the security review), and the command that audits the lock file against an advisory database (S2-010).
const SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies']
const LOCKS = ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', 'bun.lock']
// A git or tarball address is pinned by a full commit; a range that has no upper bound is open
const COMMIT = /#[0-9a-f]{40}$/
const REMOTE = /^(?:https?:|git\+|git:|github:|gitlab:|bitbucket:|[\w.-]+\/[\w.-]+(?:#.*)?$)/

/** Why a version specifier is not pinned, or null when it is exact or bounded (a caret or a tilde range is bounded, with the lock file as the pin). */
export function openRange(spec) {
  const text = String(spec).trim()
  if (REMOTE.test(text)) return COMMIT.test(text) ? null : 'an address without a full commit hash'
  if (['', '*', 'x', 'latest', 'next'].includes(text) || /^[a-z]+$/.test(text))
    return `"${text || 'empty'}" takes any version`
  return text.split('||').some((part) => /^[>]=?\s*[\w.-]+$/.test(part.trim())) ? 'a range with no upper bound' : null
}

/** @returns {{ command: string, manifests: { glob: string, locks: string[] }[], versionProblems: (file: string, text: string) => string[] }} */
export function dependencyAudit() {
  return {
    command: 'npm audit --audit-level=high',
    manifests: [{ glob: 'package.json', locks: LOCKS }],
    versionProblems(file, text) {
      let manifest
      try {
        manifest = JSON.parse(text)
      } catch {
        return [`${file} is not valid JSON`]
      }
      return SECTIONS.flatMap((section) =>
        Object.entries(manifest[section] ?? {}).flatMap(([name, spec]) => {
          const reason = openRange(spec)
          return reason ? [`${name} in ${section}: ${reason}`] : []
        })
      )
    }
  }
}
