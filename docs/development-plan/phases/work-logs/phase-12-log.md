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

### 2026-10-17 — task 12.2 (button padding and disabled contrast)
- **Tasks:** 12.2
- **Branch:** `bugfix/12.2-button-styling` — done
- **Decisions / deviations from the plan:** two causes. (1) The global `* { padding: 0 }` reset left plain `<button>` elements
  (Save/Cancel of the terminal editor) without padding: fixed once with `:where(button)` in `global.scss` (no specificity, so
  classed buttons keep their own). (2) The stock Ant Design disabled tokens are translucent, so on the black game windows the
  surface vanished and the 25 % black label was unreadable: `src/shared/buttonTheme.ts` (applied by `RootShell` through
  `ConfigProvider`) sets an opaque disabled surface and a dark label (6.2:1) and one padding per button size. The app has a
  single (light) Ant Design theme, so the colours are opaque and work on light pages and dark windows alike.
- **Problems / blockers / findings:** no Cypress flow covers a disabled button, so none was added.
- **Next step:** merge the PR; pick the next 12.x task when the user asks.
- **Verify with:** `npm test -w client -- buttonTheme`, `npm run lint -w client`, `npm run typecheck -w client`
