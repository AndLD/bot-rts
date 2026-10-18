[← Phase 16 — CI speed and agent throughput](../phase-16-ci-speed.md)

# Phase 16 — CI speed and agent throughput — work log

Append-only log used to resume the phase in a new session (AGENTS.md §7.6). Newest entry at the bottom. Add an entry
whenever a session ends or pauses, or a task finishes; commit it in the same pull request as the work.

## Entry template

```markdown
### YYYY-MM-DD — short summary
- **Tasks:** 16.x, 16.y
- **Branch:** `chore/16.x-slug` — done | WIP (what remains, what is uncommitted/unpushed)
- **Decisions / deviations from the plan:** …
- **Problems / blockers / findings:** …
- **Next step:** the exact next action
- **Verify with:** commands that show the current state is healthy
```

## Entries

### 2026-10-18 — phase planned
- **Tasks:** none started; 16.1 to 16.9 are planned (26 SP)
- **Branch:** `docs/16-ci-speed-phase` — the plan only
- **Decisions / deviations from the plan:**
  - The owner asked to record the CI speed-up as a phase of the plan. The phase is placed after Phase 15 and before Phase 10, so
    the many task pull requests of Phase 10 wait less; the owner can move it.
  - Baseline, from the push run of #216 to `develop` (run 39158838242): `verify` 21 min, of which the tests with the coverage gate
    17 min (`client` 821 s, `api` 168 s, `mcp` 10 s, run one after another); `e2e` 11 min, `lighthouse` 4 min, `docker` 1.5 min;
    `npm ci` 70 s in each job. Slowest client files: `Economy.test.tsx` 495 s, `Logs.test.tsx` 215 s, `Supervision.test.tsx` 175 s,
    `AdminDocsPage.test.tsx` 173 s, `Inspector.test.tsx` 148 s, `RetentionCard.test.tsx` 146 s.
  - The required check names and the coverage gate (value and scope) must not change; the merged-coverage job keeps the name `verify`.
- **Problems / blockers / findings:** `e2e` (11 min, of which the Cypress run is 9 min) would become the longest required check
  once `verify` is fast, so 16.9 shards it as well; the agent waits for the slowest required check, not for `verify` alone.
- **Next step:** start 16.1 when the owner asks ("Start Phase 16").
- **Verify with:** `npm run docs:check`
