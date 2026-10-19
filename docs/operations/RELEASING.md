[← README](../../README.md)

# Releasing

Bot RTS follows [Semantic Versioning](https://semver.org/) and the Git Flow of [AGENTS.md §7](../../AGENTS.md). One version number is
shared by the root package, `lib`, `api` and `client`; it is tagged as `vX.Y.Z` on `main`.

## What the number means

The public surface is the `/api/v1` API (REST and Socket.IO events, the OpenAPI document), the script API, and the configuration
(environment variables). While the major version is 0 anything may change; from 1.0.0:

| Bump  | When                                                                                                                    |
| ----- | ----------------------------------------------------------------------------------------------------------------------- |
| major | A breaking change of `/api/v1` is not allowed in place: it ships as a new `/api/v2` next to v1; also a removed documented script function or setting |
| minor | A backwards-compatible feature: new endpoints, new events, new script functions, new optional settings                  |
| patch | Bug fixes, performance work, documentation and tooling                                                                  |

Database migrations are part of the release; applied migrations are never edited (expand / contract for destructive changes).

## The changelog

[CHANGELOG.md](../product-knowledge/CHANGELOG.md) uses the Keep a Changelog headings (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`,
`Security`). A pull request that changes what a player, an API client or an operator sees adds a **fragment** in
[`changelog.d/`](../product-knowledge/changelog.d/README.md) in the same pull request (a file of its own, so that two pull requests never edit
the same lines). Pull requests that only touch tests, docs or tooling need none. `scripts/release.mjs` moves the fragments, and what
older entries still stand under `## [Unreleased]`, into the section of the version and deletes the fragments.

## A release

1. From `develop` (green CI), create the branch and let the script prepare it:

   ```bash
   git checkout develop && git pull
   git checkout -b release/1.2.0
   node scripts/release.mjs --dry-run   # shows the version and the date, writes nothing
   node scripts/release.mjs             # versions in every package.json and the lock file, CHANGELOG section
   git commit -am "chore(release): 1.2.0"
   git push -u origin release/1.2.0
   ```

2. Only fixes go on the release branch (no features). Open a pull request **into `main`**; it needs the owner's approval to merge.
3. Merge it with a **merge commit** (no squash). Then tag `main` and push the tag; the tag starts
   [the release workflow](../../.github/workflows/release.yml), which builds the Docker image, publishes it to GitHub Container Registry and
   creates the GitHub release from the changelog section:

   ```bash
   git checkout main && git pull
   git tag -a v1.2.0 -m "Release 1.2.0" && git push origin v1.2.0
   ```

4. Merge the same release branch **back into `develop`** (merge commit), so that the version bump and the fixes are not lost.
5. Do not delete the branches (AGENTS.md §7.3).

## A hotfix

Same steps, from `main`: `git checkout main && git checkout -b hotfix/1.2.1`, fix, add a changelog fragment,
`node scripts/release.mjs`, pull request into `main`, tag `v1.2.1`, then merge the hotfix branch into `develop` as well.

## Deploying a release

See [DEPLOYMENT.md](./DEPLOYMENT.md): the Docker image `ghcr.io/andld/bot-rts-api:<version>` (API and engine, selected by `APP_ROLE`),
the compose stack in `docker-compose.yml`, or the PM2 setup in `ecosystem.config.json`. Apply the migrations first
(`npx prisma migrate deploy`, the `migrate` service of the compose stack), then start the new `engine` node, then roll the `api` nodes
one by one. The client is deployed from the same tag (Vercel builds it from the repository).
