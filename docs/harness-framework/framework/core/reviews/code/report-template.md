# Code Quality Review — YYYY-MM-DD

**Type:** full | delta | targeted · **Commit reviewed:** `<sha>` (integration branch) · **Reviewer:** who or which agent session ·
**Previous report:** none | filename · **Size:** packages, source lines, test lines

> Two or three sentences: the verdict, the largest risk, the largest strength. Be blunt and specific.

## 1. Scorecard

Scale `1` (poor) to `5` (excellent). Carried scores (delta reviews) are marked `c`.

| Dimension                       | Previous | Current | Target | Notes |
| ------------------------------- | -------- | ------- | ------ | ----- |
| C1 Architecture and coupling    |          |         |        |       |
| C2 SOLID                        |          |         |        |       |
| C3 Test coverage and quality    |          |         |        |       |
| C4 Testability                  |          |         |        |       |
| C5 Scalability and performance  |          |         |        |       |
| C6 Maintainability              |          |         |        |       |
| C7 Security and robustness      |          |         |        |       |
| C8 Errors and observability     |          |         |        |       |
| C9 Dependencies and build       |          |         |        |       |
| C10 Delivery gates              |          |         |        |       |

Gate: pass | fail (reason).

## 2. Gate results

| Gate (K1) | Command | Result | Duration | Key numbers |
| --------- | ------- | ------ | -------- | ----------- |

## 3. Inventory

Packages, files and lines (source and tests), layers present, generated files excluded. Declared versus actual structure.

## 4. Test coverage

Per package and layer: statements, branches, functions, lines, against the gate; files below the gate; tests per type.

| Package | Statements | Branches | Functions | Lines | Files below gate |
| ------- | ---------- | -------- | --------- | ----- | ---------------- |

## 5. Assessment by dimension

One subsection per dimension, in the order C1 to C10. Each: evidence, what is good, what is not, finding ids. SOLID (C2) has five
short parts, one per principle, each with its own verdict word (weak, partial, acceptable, good).

### C1 Architecture and coupling

| Coupling problem | Location(s) | Impact |
| ---------------- | ----------- | ------ |

## 6. Strengths (keep list)

## 7. Hotspots

| File | Size | Complexity | Churn | Why it is on the list |
| ---- | ---- | ---------- | ----- | --------------------- |

## 8. Prioritized findings

Most severe first. Fields as in the method, section 4.

### 🔴 Critical

#### C-YYYYMMDD-01 — short title

- **Dimension:** · **Standard:** · **Effort:** · **Status:**
- **Evidence:**
- **Impact:**
- **Fix:**

### 🟠 High

### 🟡 Medium

### 🔵 Low

## 9. Carry-over from the previous report

| Previous id | Status (closed, carried, regressed) | Note |
| ----------- | ----------------------------------- | ---- |

## 10. Verdict and recommended order of work

Short verdict, then the ordered steps, each naming the findings it removes and what it unblocks.

## 11. Follow-up

| Finding | Action (task id, pull request or backlog item) | Owner |
| ------- | ---------------------------------------------- | ----- |
