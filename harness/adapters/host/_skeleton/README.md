# Skeleton of a host adapter

Copy this folder to `adapters/host/<name>/` and fill it as [the new-adapter guide](../../../core/contracts/new-adapter.md) says. The manifest,
`protect.mjs`, `workflows.mjs` and `conformance.json` carry `TODO` markers; the conformance suite fails until each one is replaced.

Optional roles (`merge-guard` with its module, `ci-timings`, `scaffold-files`) are added to the manifest only when the host has them; a host that cannot
protect its branches needs the merge guard. See the github preset. The workflow templates go in `templates/`, listed in the manifest's `templates`.
