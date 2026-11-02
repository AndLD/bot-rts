// The protection of this host (contract roles "protection-available" and "branch-protection"). The host's command line is the seam `cli(args, input)`,
// which returns `{ status, stdout, stderr }`; the conformance suite passes a stand-in for it and checks what is sent.

/** Whether the host can enforce the protection on this repository (its plan, its visibility): `{ available, reason }`. An answer that cannot be told is an error. */
export function detectProtection({ slug, cli }) {
  throw new Error('TODO: ask the host whether it can protect the repository')
}

/**
 * Applies the protection of the profile, idempotently: no deletion and no force-push of the production and the integration branch, a pull request for
 * every change, the required checks of `profile.requiredChecks`, and administrators may bypass only when merging a pull request. It changes nothing
 * and reports a problem when `profile.host.protection` and `detectProtection` disagree.
 * @returns {{ messages: string[], problems: string[] }}
 */
export function protect({ profile, slug, cli }) {
  throw new Error('TODO: apply the protection to the host')
}
