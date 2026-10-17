[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 12 — Issues and stabilization (8 SP, grows as issues are added)

**Status:** 🟡 In progress · **Branches:** `bugfix/12.2-button-styling` (see the [implementation log](#implementation-log)) · **Work log:** [phase-12-log](./work-logs/phase-12-log.md)

A running collection of **issues found while using and testing the finished phases**: defects, performance problems and
rough edges that are not part of any earlier phase's scope. It is open-ended: new issues are added as tasks (`12.N`) when
they are found, each with a reproduction, and the phase is closed when the user says so. It needs nothing from Phases 9 and 10
and can be developed at any time; its points count in the total of the plan index and grow as issues are added.

**How an issue becomes a task.** Add a row to the table with the symptom and how to reproduce it, the expected result, and a
story-point estimate; fix it on its own branch (`bugfix/12.N-slug`) with a test that reproduces it first (AGENTS.md §6.5), and
update this file, the work log and the plan index in the same PR. If the cause turns out to be a design problem, record the
decision in the matching `docs/product-knowledge/game-design/` file.

| # | Task | SP | Status |
| --- | --- | --- | --- |
| 12.1 | **A single runaway script keeps the tick time high when few players are online.** Found with the load harness (`npm run load`, see [load testing](../../testing/load-testing.md)): `--players 5 --duration 40` gives a tick p95 of about 115 ms and 13 % of the ticks overran (limits: 80 ms and 5 %); `--players 5 --hogs 0` is healthy (p95 about 11 ms, no overruns), and so is `--players 50` with 10 hogs (p95 about 10 ms, no overruns, the 10 hogs killed). In the 5-player run the one hog (`for (;;) {}`) is the missing execution (9 of 10 alive), so the engine does kill it, yet the tick time stays high for the whole run. Find the cause and fix it, or, if it is only an artifact of the harness with very few scripts, fix the harness and document it. Hypotheses, none confirmed: the cost of killing a hog and rebuilding its QuickJS sandbox (`dispose()` in `quickjs-script-runtime.ts`); a hog that is launched or cut again and again; `ENGINE_SLICE_MS` (5 ms) not honoured; the way the harness assigns hogs in tiny runs; the window of the `botrts_engine_tick_p95_milliseconds` gauge. Deliver a reproduction as an engine test with one runaway script (injected clock and RNG), the fix, the numbers in [load testing](../../testing/load-testing.md) updated if they change, and a `CHANGELOG.md` line | 5 | ✅ |
| 12.2 | **Buttons across the client have inconsistent padding and unreadable disabled states.** Found in use: (1) some buttons, such as "Save" and "Cancel", have no horizontal padding, so the label touches the edges and looks cramped; (2) some buttons get a dark background when inactive or disabled while the text stays dark, so the label is unreadable. Audit most buttons across the client (every dialog, form, window and admin page; custom-styled buttons as well as Ant Design ones, including any global CSS that overrides `.ant-btn` padding or disabled colours), find the shared cause, and fix it in one place (theme tokens or a shared button style) instead of per button. Expected: every button has consistent horizontal padding, and every disabled or inactive state keeps a readable contrast (WCAG AA) in both themes. Deliver a component or unit test per fix (padding and disabled colours of the shared style), a Cypress check of a disabled button if a flow covers one, and a `CHANGELOG.md` line | 3 | ✅ |

## Exit criteria

Every issue listed above is fixed with a test that failed before the fix, or is closed with a recorded reason; the coverage
gate (≥ 97 %) stays green. The phase is closed by the user, not by the list running out.

## Implementation log

Branches and pull requests that implemented this phase's tasks, added when each one is merged (branch names follow
AGENTS.md §7.1).

| Branch | Tasks | PR | Status |
| --- | --- | --- | --- |
| `bugfix/12.2-button-styling` | 12.2 | [#206](https://github.com/AndLD/bot-rts/pull/206) | merged |
| `bugfix/12.1-runaway-script-tick` | 12.1 | [#207](https://github.com/AndLD/bot-rts/pull/207) | merged |
