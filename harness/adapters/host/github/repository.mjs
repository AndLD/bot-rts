// The GitHub host adapter's repository address (design §4.3, role "repository address"): the web address of a repository from its slug. The bootstrap
// writes it into `repository.url` of a new project's profile file, where `harness release` takes the compare and tag links of the changelog from.

/** The web address of the repository `slug` (owner/name) on GitHub. */
export function repositoryUrl({ slug }) {
  return `https://github.com/${slug}`
}
