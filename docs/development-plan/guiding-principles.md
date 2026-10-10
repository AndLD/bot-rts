[← Development plan index](../DEVELOPMENT-PLAN.md)

# Guiding principles

0. **Scope decision:** the game is an endless sandbox (no victory condition, seasons, resets or leaderboard), so no
   match/round/scoring subsystem is planned.

1. **Stabilize before feature work.** Fix the broken client build, env/config drift, and tooling first.
2. **Pin behavior, then refactor, then backfill tests.** Coarse safety-net tests (task 0.7) come first so refactors can be
   verified; the code is then made testable (services free of `req`/`res` and global `db` singletons) before the full
   coverage backfill.
3. **Every phase ships green.** No phase is "done" without lint + typecheck + unit + integration (+ e2e where a UI flow
   changed) and ≥ 97 % coverage on the touched code.
4. **Behavior-preserving refactors first**, then behavioral changes, in separate PRs.
5. **Feature work is incremental and behind interfaces**, so the script engine, scheduler, and module system can be
   evolved without rewriting the transport/UI.
