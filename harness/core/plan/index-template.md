# <Plan title>

<Goal of the plan and the sequencing principle, in two or three sentences.>

**Phase status legend:** <symbols and meanings>. A phase's status is kept in the summary table and in the phase file, and is
updated in the change that starts or finishes it.

**Task status** is tracked per task in the phase files. Each phase has an append-only **work log** so it can be resumed in a new session.

**Estimation scale:** <unit, scale, what an estimate includes>.

**Summary** (written from the phase files by the plan-summary command of the profile; edit a phase file, not this table)

<!-- plan-summary:start -->
| Phase | Theme | Size | Agent complexity | Status |
| ----- | ----- | ---- | ---------------- | ------ |
| 0     |       |      | C1–C2            |        |
|       | **Total** | | | |
<!-- plan-summary:end -->

The agent-complexity column is the range of each phase's markers (plan method, section 7); a plan without markers has no such column.

**Order of development.** <Only if different from the numbering: the actual order and the reason, with the date. A project that ships versions keeps the order in the releases file ([`releases-template.md`](./releases-template.md)) instead, and this section holds the generated block between `<!-- plan-releases:start -->` and `<!-- plan-releases:end -->` with a link to the file.>

---

## Scope definition

<What the finished product is for this plan. What is excluded.>

---

## Gates

<Conditions before deployment or release, each naming task ids.>

---

## Resuming work in a new session

<Request forms, what the session reads first, when it stops, who approves what.>

---

## Contents

- Principles and cross-cutting documents: <links to the files in the cross-cutting folder>
- Phases (written by the plan-summary command):

<!-- plan-contents:start -->
- <one line per phase: title, size, link to the file in the phases folder>
<!-- plan-contents:end -->

- Work logs: <one link per phase>
