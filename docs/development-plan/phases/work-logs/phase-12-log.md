[← Phase 12 — Issues and stabilization](../phase-12-issues.md)

# Phase 12 — Issues and stabilization — work log

Append-only log used to resume the phase in a new session (AGENTS.md §7.6). Newest entry at the bottom. Add an entry
whenever a session ends or pauses, or a task finishes; commit it in the same pull request as the work.

## Entry template

```markdown
### YYYY-MM-DD — short summary
- **Tasks:** 12.x, 12.y
- **Branch:** `bugfix/12.x-slug` — done | WIP (what remains, what is uncommitted/unpushed)
- **Decisions / deviations from the plan:** …
- **Problems / blockers / findings:** …
- **Next step:** the exact next action
- **Verify with:** commands that show the current state is healthy
```

## Entries

### 2026-10-14 — phase created
- **Tasks:** none started; 12.1 is planned
- **Branch:** `docs/phase-12-issues` — the plan only
- **Decisions / deviations from the plan:** the phase is open-ended and collects issues found in use; more tasks will be added as
  they appear. It is outside the MVP count.
- **Problems / blockers / findings:** 12.1 was found while checking the fix of the load harness that left API servers running
  after a run (PR #148).
- **Next step:** start 12.1 when the user asks; first reproduce it with an engine test.
- **Verify with:** `git status`, `git branch -a`, the open pull requests.
