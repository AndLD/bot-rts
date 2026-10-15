[← Quality reviews](../README.md)

# Code quality reviews

Instruction for reviewing the quality of the **source code** against the project's own declared quality bar. A review
produces one dated report in this folder (`YYYY-MM-DD.md`), built from [`_template.md`](./_template.md). The review of the
documentation and AI harness is a separate method, in the sibling folder.

This file is the **method** and is project-neutral, so it can move to a blueprint unchanged. What belongs to one project
(its bar, packages, layers, commands, thresholds, generated files) is in [`bindings.md`](./bindings.md). The reviewer reads both.

A review is a **point-in-time assessment**: blunt, evidence-based, and read-only for the code. It says where the code stands
against the bar, what is wrong and in what order to fix it. It does not fix anything.

---

## 1. Scope

In scope: all source code of all packages, the tests, build and dependency configuration, and the delivery mechanisms that
gate the code (CI, hooks, branch rules) *as seen from the code*.

Out of scope: documentation and agent instructions (harness review), product decisions, visual design, and generated files
(reviewed only for freshness; `bindings.md` lists them).

The **bar** is not invented by the reviewer. It is the project's declared quality rules (principles, layering, coverage gate,
definition of done), named in `bindings.md`. A review measures the distance between the code and that bar. Where the declared
bar is itself contradictory or unmeasurable, report that as a finding about the bar.

---

## 2. Dimensions and scoring

Scale `1` (poor) to `5` (excellent). The report shows **Current** and **Target**; the target is the desired end state, taken
from the bar. A score needs evidence (file and line, or a measured number); a score without evidence is invalid.

| Id  | Dimension                    | The question                                                                                               | Typical evidence |
| --- | ---------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------- |
| C1  | Architecture and coupling    | Do dependencies follow the declared layers, and can parts be replaced independently?                       | boundary check result, coupling table, shared types leaking implementation details |
| C2  | SOLID                        | Single responsibility, open/closed, Liskov, interface segregation and dependency inversion, each assessed separately | oversized or mixed-purpose units, central switches, stubs that break contracts, wide interfaces, concrete singletons |
| C3  | Test coverage and quality    | Is the code covered to the gate, and do the tests actually protect it?                                     | coverage per package and layer, test types present, assertion strength, flaky or order-dependent tests |
| C4  | Testability                  | Can a unit be tested in isolation, deterministically?                                                      | global mutable state, hidden I/O, environment read at import, direct clock and randomness, framework objects in business code |
| C5  | Scalability and performance  | Will it hold under the intended load and scale out?                                                        | statelessness, indexes and query shapes, algorithmic complexity of hot paths, in-process state, limits and pagination, back-pressure |
| C6  | Maintainability              | Can a newcomer change it safely?                                                                           | dead code, duplication, size and complexity outliers, naming, config drift, type-safety escapes, mixed conventions |
| C7  | Security and robustness      | Are inputs validated, access controlled, secrets handled, failures contained?                              | authentication and authorization paths, validation at boundaries, secret handling, abuse limits, unhandled-failure paths |
| C8  | Errors and observability     | Are failures typed, preserved and visible?                                                                 | swallowed errors, generic status mapping, logging discipline, metrics, traceability |
| C9  | Dependencies and build       | Is the build reproducible and the dependency set healthy?                                                  | lockfile, workspace setup, deprecated or unused packages, build and typecheck cleanliness |
| C10 | Delivery gates               | Do automated gates enforce the bar before code merges and ships?                                           | CI jobs, hooks, branch protection, release process, what a failing gate blocks |

Scoring anchors for every dimension: `1` the bar is largely unmet, with systemic problems · `2` major gaps · `3` mostly met,
known and bounded exceptions · `4` met, small isolated issues · `5` met and defended by automated checks.

Rules of evidence:

- **Measure before judging.** Prefer a number from a tool (coverage, boundary violations, size, complexity, duplicates) to an impression.
- **Show the instance.** A pattern claim ("services touch the transport layer") cites at least two locations, or a count from a search that can be repeated.
- **Name the standard.** Each finding names the rule of the bar it breaks. If it breaks none, it is taste; drop it or mark it 🔵.
- **Separate legacy from regression.** A problem present in the previous report is *carried*; a new one is *new*; a fixed one is *closed*.
- **Credit what is good.** Keep a "strengths" list so a later refactoring does not remove it.

### Gates

A review **fails** when any dimension scores `1` or `2`, when a 🔴 finding is open, or when a declared hard gate (for example the
coverage threshold) is not met. A failing review does not stop work; it sets the order of work (section 6).

---

## 3. Procedure

Work on a documentation-type branch cut from the integration branch, named after the review date. The review is **read-only
for the code**: it adds one report and updates the index that links to it. Fixes are separate changes after approval.

1. **Prepare.** Record the commit under review, the date, the reviewer, the previous report and its scorecard. Read `bindings.md`
   and the previous report's open findings.
2. **Baseline the gates.** Run every gate command of `bindings.md` on a clean checkout (install, lint, typecheck, boundary check,
   tests with coverage, build). Record pass or fail, duration and the key numbers. A gate that cannot run is a finding.
3. **Inventory.** Packages, size per package (files and lines, source versus test), layers present, and the declared-versus-actual
   structure. List generated and vendored files so they are excluded from size and quality counts.
4. **Measure.** Run the measurements of `bindings.md` (section 5 of the method lists them by id) and record command and result.
5. **Find hotspots.** Rank files by size, complexity, churn (change frequency) and by being on a critical path. Read the top of the
   ranking in full, plus a random sample of files from every package, so findings are not only what a search can see.
6. **Assess by dimension.** For C1 to C10 collect evidence, write findings, score. Check each critical rule of the bar with a
   direct test, not by assumption (for example: try to find one violation of each forbidden-import rule by search).
7. **Verify findings.** Re-open every cited location and confirm it before it goes into the report. Remove findings that cannot
   be reproduced. Carry over, close or mark regressed every finding of the previous report.
8. **Report.** Fill [`_template.md`](./_template.md) as `YYYY-MM-DD.md` in this folder; add `-2` for a second review on one
   day. Link it from the index in `bindings.md`. State the verdict and the recommended order of work.
9. **Follow-up.** After approval, 🔴 and 🟠 findings become tasks in the delivery plan; 🟡 and 🔵 go to the backlog. Record the
   resulting task ids in the report's follow-up table.

For a very large codebase, the reviewer may split packages among read-only subagents (inventory, measurements and per-package
dimension notes), then merges the results and does the cross-package dimensions (C1, C10) and the verification step alone.

---

## 4. Findings

One finding per problem, so it can become one task.

| Field          | Content                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------- |
| ID             | `C-<YYYYMMDD>-<nn>`                                                                               |
| Severity       | 🔴 critical: security hole, data loss, build or gate broken, bar systemically unmet · 🟠 high: blocks scale, testing or safe change · 🟡 medium: maintainability · 🔵 low: polish |
| Dimension      | C1 to C10                                                                                         |
| Standard       | The rule of the bar that is broken                                                                |
| Evidence       | `path:line` locations or a repeatable count                                                       |
| Impact         | The concrete failure: what breaks, who is hurt, what it blocks                                    |
| Fix            | The smallest change that removes it, and the order dependency on other findings                   |
| Effort         | S (under an hour) · M (a session) · L (several sessions)                                          |
| Status         | new · carried · closed · regressed                                                                |

Rules: do not report the same root cause twice (link the symptoms); do not report generated code; prefer a root cause to a list
of instances; give a fix that does not break another rule of the bar.

---

## 5. Measurements

Generic measurements. `bindings.md` gives the command for each.

| Id  | Measurement                                                                                   | Dimension |
| --- | --------------------------------------------------------------------------------------------- | --------- |
| K1  | Gate results: install, lint, typecheck, boundary check, tests, build (pass, fail, duration)   | C9, C10   |
| K2  | Coverage per package and per layer, for each of statements, branches, functions, lines; files below the gate | C3 |
| K3  | Tests per type (unit, integration, end to end); skipped or disabled tests; test-to-source line ratio | C3 |
| K4  | Boundary violations: forbidden imports per the declared layering                              | C1        |
| K5  | Size and complexity outliers: files and functions over the thresholds                         | C2, C6    |
| K6  | Dead code: unused exports and files, commented-out blocks, debug output left in               | C6        |
| K7  | Type-safety escapes: untyped (`any`-like) public signatures, suppression comments, unchecked casts | C6    |
| K8  | Duplication: repeated blocks and repeated constants across packages                           | C6        |
| K9  | Hidden dependencies: module-level mutable state, environment read at import, direct clock and randomness in logic | C4 |
| K10 | Hot-path review: data-access shapes, loops over collections, unbounded queries, in-process state | C5       |
| K11 | Security checks: unauthenticated or unauthorized routes, unvalidated inputs, secrets in the repository, abuse limits | C7 |
| K12 | Error handling: swallowed or generalized errors, typed-error usage, logging discipline         | C8        |
| K13 | Dependency health: outdated, deprecated, unused or duplicated packages; lockfile state        | C9        |
| K14 | Churn: files changed most often in a period, crossed with size                                | hotspots  |
| K15 | Generated-file freshness: regenerated output equals committed output                          | C9, C10   |

---

## 6. Report content and verdict

The report follows the template: scorecard, results of the gates, assessment by dimension (with the coupling table), strengths,
prioritized findings, carry-over from the previous report, verdict and recommended order of work. The order of work follows
the dependencies between findings, not only severity: unblock the build and the gates first, then remove what makes the code
untestable, then refactor under tests, then add features.

---

## 7. Cadence

| When                                                                 | Review type                                         |
| -------------------------------------------------------------------- | --------------------------------------------------- |
| First review of a codebase, and before a major release               | **Full**: all dimensions, all packages              |
| End of each plan milestone                                           | **Delta**: packages and layers changed since the last report, C3, C10, the carried findings |
| After a large refactoring or an architecture change                  | **Delta** on the affected dimensions                |
| A production incident or a gate that was bypassed                    | **Targeted**: the failing area and its dimension    |

A delta report names the dimensions it did not re-score and carries their previous scores forward, marked as carried.

---

## 8. Keeping this method healthy

- The method (this file) stays project-neutral: a repository name or tool here is a leak. Put it in `bindings.md`.
- When a dimension or measurement proved unusable, change the method in the same pull request and add a line to the changelog.
- Automate a measurement (a script run by the CI) once it has been run by hand twice.

### Method changelog

| Date       | Change                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------- |
| 2026-10-16 | First written method, derived from the structure of the 2026-10-10 report: scorecard, SOLID, coupling, scalability, testability, maintainability, prioritized findings, verdict. Added security, errors, dependencies and gates as dimensions, hotspot analysis, finding verification and carry-over. |
