---
name: new-adapter
description: Use when a project needs an adapter the framework has no preset for (a language and its tools, a coding agent, or a repository host).
invocation: explicit
---

# Write a new adapter

The guide with the sample fields and everything the conformance suite checks is `harness/core/contracts/new-adapter.md`; the roles of each axis are in the contract of the axis next to it (`stack.md`, `runtime.md`, `host.md`). In short:

1. Copy `harness/adapters/<axis>/_skeleton/` to `adapters/<axis>/<name>/` in a checkout of the framework, and set `name` in its manifest to the folder's name.
2. Fill the manifest role by role from the contract of the axis; write the logic modules as pure functions with `node --test` tests next to them; fill `conformance.json`, and for a runtime record the event samples.
3. Run `node harness/tools/harness.mjs adapter test adapters/<axis>/<name>` until every check passes; a check that fails names what is missing.
4. Record the adapter in `framework.json`, the changelog and the framework README, add it to the framework's conformance tests, and offer it upstream.
