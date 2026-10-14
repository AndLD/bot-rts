[← Testing](../README.md)

# Quality sweep of Phase 8 (task 8.8)

A snapshot taken on 2026-10-14. The lasting parts (flaky-test handling, expected output) are kept current in [known-issues.md](../known-issues.md).

- **Coverage at the end of the phase** (statements / branches / functions / lines): `api` 99.98 / 99.72 / 100 / 99.98 %, `client` 99.96 / 99.88 / 100 /
  100 %, `mcp` 100 %. The gate stays at 97 % per package, and CI also checks that every changed file reaches it.
- **Flaky tests.** The suites that measure real time or run the Ant Design components in jsdom failed now and then when the whole suite
  ran in parallel with coverage (the pre-push hook and CI). Their bounds are now set for a busy machine: the real-time tick bound of
  `engine-load.test.ts` and the time a memory bomb may take in `quickjs-sandbox.test.ts` only catch a runaway; React Testing Library waits
  up to 5 s (`client/jest.setup.ts`); the follow-the-end behaviour of the terminal no longer depends on the order of a scroll event; the
  Cypress notification spec waits for the script's finished notification before it marks everything read. What a tick really costs is
  measured by the load harness (`docs/testing/load-testing.md`), not by a unit test.
- **The `Aborted(Assertion failed: list_empty(&rt->gc_obj_list)` line** in the test output comes from the sandbox attack tests: a sandbox
  that ran out of memory or stack cannot always be taken apart cleanly, so the engine drops its module and makes a new one (`dispose()` of
  `quickjs-script-runtime.ts`). It is expected there; it must not appear in the output of any other suite.
- No `console.log`, commented-out code or untyped `any` boundaries remain in the packages; the lint, type, import-boundary, i18n and link
  checks are part of CI.

