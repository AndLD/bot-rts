# Security Review — YYYY-MM-DD

**Type:** full | targeted · **Commit reviewed:** `<sha>` (integration branch) · **Reviewer:** who or which agent session ·
**Previous report:** none | filename · **Catalogue:** the framework version whose probes were used

> Two or three sentences: the verdict, the largest risk, the largest strength. Be blunt and specific. Follow section 7 of the method: no secret, and no steps to reproduce an open exploitable finding where others can read this.

## 1. Scorecard

Scale `1` (poor) to `5` (excellent). Carried scores (targeted reviews) are marked `c`. A dimension that does not apply says `n/a` and why.

| Dimension                        | Previous | Current | Target | Notes |
| -------------------------------- | -------- | ------- | ------ | ----- |
| S1 Secrets                       |          |         |        |       |
| S2 Dependencies and supply chain |          |         |        |       |
| S3 CI and the repository host    |          |         |        |       |
| S4 Agent harness                 |          |         |        |       |
| S5 The product's attack surface  |          |         |        |       |
| S6 Operations                    |          |         |        |       |

Gate: pass | fail (reason).

## 2. Threat model

What changed in the threat model of the bindings since the last review, or "not applicable" with the reason.

Project traits decided from the repository, for the field Applies of the probes (the reviewer decides each, with the reason where it is not obvious):

- **Has:**
- **Does not have:**

## 3. Automation

| Command | Date | Result |
| ------- | ---- | ------ |

Scriptable probes with no check (gaps):

## 4. Results of the probes

One row per probe selected, including those of the bindings. A probe not run is not a pass.

| Probe | Result (pass, fail, n/a, not run) | Evidence or reason | Finding |
| ----- | --------------------------------- | ------------------ | ------- |

## 5. Scenarios

The scope of the bindings that was in force (its date and who approved it). One row per scenario that applies.

| Scenario | Environment | Result (safe, unsafe, not run) | Evidence kept | Cleanup | Finding |
| -------- | ----------- | ------------------------------ | ------------- | ------- | ------- |

## 6. Strengths (keep list)

## 7. Prioritized findings

Most severe first. Fields as in the method, section 6.

### 🔴 Critical

#### S-YYYYMMDD-01 — short title

- **Dimension:** · **Probe:** · **Effort:** · **Status:** · **Outcome:**
- **Evidence:**
- **Impact:**
- **Fix:**

### 🟠 High

### 🟡 Medium

### 🔵 Low

## 8. Carry-over from the previous report

| Previous id | Status (closed, carried, regressed) | Note |
| ----------- | ----------------------------------- | ---- |

## 9. The method itself

A probe that did not apply, one that was unclear, one that is missing, a step of the procedure that did not work. Each is an edit or an issue.

## 10. Verdict and recommended order of work

Short verdict, then the ordered steps, each naming the findings it removes.

## 11. Follow-up

The loop of the method (section 9): what each finding became.

| Finding | Severity | Outcome (one or more of fix, probe, rule candidate) | Issue, probe or report upstream |
| ------- | -------- | -------------------------------------------------- | ------------------------------- |
