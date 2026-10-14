[← Testing](./README.md)

# Known issues

## Flaky tests and how they are kept stable

Suites that measure real time or run the Ant Design components in jsdom used to fail now and then when the whole suite ran in
parallel with coverage (the pre-push hook and CI). Their bounds are set for a busy machine:

- The real-time tick bound of `engine-load.test.ts` and the time a memory bomb may take in `quickjs-sandbox.test.ts` only catch a
  runaway. What a tick really costs is measured by the load harness ([load-testing.md](./load-testing.md)), not by a unit test.
- React Testing Library waits up to 5 s (`client/jest.setup.ts`).
- The follow-the-end behaviour of the terminal does not depend on the order of a scroll event.
- The Cypress notification spec waits for the script's finished notification before it marks everything read.

If a new test fails only under load, fix its bound or its waiting, do not retry it.

## Expected output that looks like an error

The line `Aborted(Assertion failed: list_empty(&rt->gc_obj_list)` in the test output comes from the sandbox attack tests: a sandbox
that ran out of memory or stack cannot always be taken apart cleanly, so the engine drops its module and makes a new one
(`dispose()` of `quickjs-script-runtime.ts`). It is expected there; it must not appear in the output of any other suite.
