# Skeleton of a stack adapter

Copy this folder to `adapters/stack/<name>/` and fill it as [the new-adapter guide](../../../core/contracts/new-adapter.md) says. The manifest, the three
modules and `conformance.json` carry `TODO` markers; the conformance suite fails until each one is replaced.

A role the contract makes optional (`e2e-runner`, `coverage-merge`, `typecheck`, `import-boundaries`, `generated-files`, `scaffold-files`) is added to the
manifest only when the stack has it; `coverage-merge` and `scaffold-files` are logic roles with a module (see the node-ts preset).
