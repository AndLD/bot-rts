# Skeleton of an agent-runtime adapter

Copy this folder to `adapters/runtime/<name>/` and fill it as [the new-adapter guide](../../../core/contracts/new-adapter.md) says. The manifest,
`packaging.mjs` and `conformance.json` carry `TODO` markers, and `events/` waits for the recorded samples; the conformance suite fails until each one is
done.

Optional roles (`hook-configuration` with its `settings.mjs`, `hook-io`, `pull-request-tools`, `waiting-advice`, `model-map`, `scaffold-files`) are
added to the manifest only when the runtime has them; see the claude-code preset.
