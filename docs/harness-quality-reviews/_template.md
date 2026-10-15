# Harness Quality Review — YYYY-MM-DD

**Type:** full | delta | targeted · **Commit reviewed:** `<sha>` (integration branch) · **Reviewer:** who or which agent session ·
**Method version:** date of the last method-changelog entry · **Previous report:** none | filename

> Two or three sentences: the verdict, the biggest risk, the biggest strength.

## 1. Scorecard

Scale `1` (poor) to `5` (excellent). Carried scores (delta reviews) are marked `c`.

| Dimension                          | Previous | Current | Target | Notes |
| ---------------------------------- | -------- | ------- | ------ | ----- |
| D1 Layer integrity                 |          |         | 5      |       |
| D2 Domain model                    |          |         | 4      |       |
| D3 Injection and parametrization   |          |         | 5      |       |
| D4 Cohesion and responsibility     |          |         | 4      |       |
| D5 Extensibility and contracts     |          |         | 4      |       |
| D6 Routing and context economy     |          |         | 4      |       |
| D7 Enforceability                  |          |         | 5      |       |
| D8 Truth and freshness             |          |         | 4      |       |
| D9 Clarity and actionability       |          |         | 4      |       |
| D10 State and resumability         |          |         | 4      |       |
| D11 Product integrity              |          |         | 4      |       |
| D12 Open items and completeness    |          |         | 4      |       |
| **Blueprint readiness**            |          | `%`     | 90 %   |       |

Gate: pass | fail (reason).

## 2. Inventory and layer map

Files and sections by layer, with corrections to the table in `bindings.md`. Unclassified and doubly-classified items are listed here.

## 3. Measurements

| Id  | Command or method | Result | Previous |
| --- | ----------------- | ------ | -------- |
| M1  |                   |        |          |

## 4. Cold-start probes

| Probe | Files read | First action | Wrong or uncertain steps | Verdict |
| ----- | ---------- | ------------ | ------------------------ | ------- |

## 5. Assessment by dimension

One subsection per scored dimension: evidence, what is good (the keep list), what is not, finding ids.

## 6. Findings

Most severe first. Fields as in the method, section 5.

### H-YYYYMMDD-01 — short title

- **Severity:** · **Dimension:** · **Effort:** · **Export impact:**
- **Evidence:**
- **Why it matters:**
- **Fix:**

## 7. Product integrity (D11)

Coverage: sections read of total. Ledger summary per context (claims extracted, findings). Invariants tested and result.
Traceability counts (M14). Gap-probe results (P6).

| Context | Sections | Claims | Contradictions | Gaps | Other |
| ------- | -------- | ------ | -------------- | ---- | ----- |

## 8. Open items and completeness (D12)

Headline numbers, always together:

| Measure                | This review | Previous | Trend |
| ---------------------- | ----------- | -------- | ----- |
| Documented % (M17)     |             |          |       |
| Delivered % (M18)      |             |          |       |
| Ready to build next % (M19) |        |          |       |
| Open items (M16)       | declared / hidden / stale |  |      |

Inventory (one row per open item):

| Id | Location | Form | Kind | Blocks | Age | Owner | Declared |
| -- | -------- | ---- | ---- | ------ | --- | ----- | -------- |

Evaluation: blockers of the next milestones, items without owner, the questions that must be answered and by whom.

## 9. Export dry run

| Bucket                                   | Content |
| ---------------------------------------- | ------- |
| Copy unchanged (CORE)                    |         |
| Re-implement per stack (ADAPTER)         |         |
| Supply per project (PROFILE values)      |         |
| Drop (DOMAIN, STATE)                     |         |
| Extraction blockers                      |         |

## 10. Follow-up

| Finding | Action (task id, pull request or backlog item) | Owner |
| ------- | ---------------------------------------------- | ----- |
