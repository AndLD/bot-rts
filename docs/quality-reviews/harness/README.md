# Harness quality reviews

Instruction for reviewing the quality of the **harness**: everything in the repository that steers an AI agent or a human
contributor, as opposed to the product code. It is separate from the review of the code itself. A review produces one dated
report in this folder (`YYYY-MM-DD.md`), built from
[`_template.md`](./_template.md).

This file is the **method** and is written to be project-neutral, so it can move to a blueprint unchanged. Everything that
belongs to this repository (which file sits in which layer, commands, term lists, thresholds) is in
[`bindings.md`](./bindings.md). The reviewer reads both.

---

## 1. What is reviewed

The **harness** is:

- the entry points agents load first (the agent instruction file, the project readme);
- the documentation tree: product specification, delivery plan, session logs, operations, testing, integrations;
- the mechanisms that enforce or automate the rules: Git hooks, CI workflows, check scripts, launch configuration;
- agent configuration kept outside the repository (user memory, settings). It is reviewed only for **duplication of repository
  rules**; it is never edited by a review.

The **product knowledge** (the product specification and everything that states what the product is and must do) is in
scope in two ways: its *structure* (layers, language, duplication; D1 to D3) and its *logical integrity* (D11: whether it is
consistent, complete and buildable as written) and its *completeness* (D12: what is still open, and how much of the product is
specified and delivered). The **complexity** of both the harness and the product knowledge is assessed (D13).

Not reviewed: product source code (reviewed separately) and whether a product decision is *good* (taste, fun, market fit,
balance quality). A decision that contradicts another decision, or a number that cannot hold under the specification's own
rules, is a D11 finding; an opinion that a number should be different is not.

**Goal of the review:** answer seven questions with evidence.

1. Does an agent that starts cold do the right thing, quickly, with little context? (effectiveness)
2. Is each rule and fact written once, in the right place, and true today? (integrity)
3. Can the business knowledge be separated from the infrastructure that serves it? (architecture)
4. Could the generic part be extracted and injected into a new project? (blueprint readiness)
5. Is the product knowledge free of contradictions and gaps, so that someone can build from it without guessing? (product integrity)
6. How much of the product is specified, how much is delivered, and what remains open or undecided? (completeness and progress)
7. How complex is the harness and the product knowledge, how much of it is essential, and is it growing faster than it pays for itself? (complexity)

---

## 2. The lens: clean architecture applied to documents

The code rules (SOLID, DDD, clean architecture, dependency injection) are adapted as follows. The mapping is the
basis of every score below.

| Code concept             | Harness equivalent                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Domain layer             | **Product knowledge**: what the product is and how it behaves (product specification, glossary, public contract). No tool or process names. |
| Application layer        | **Method**: how work is done regardless of tools (principles, workflow, definition of done, session protocol, templates). |
| Infrastructure           | **Stack adapters**: the concrete tools that realize the method (frameworks, test runners, CI, hooks, scripts, hosting). |
| Port (interface)         | A **role the method needs**, named abstractly ("coverage gate", "integration database", "release branch").  |
| Adapter                  | The stack-specific statement that fills a role ("Jest, 97 %, Postgres in Docker").                          |
| Dependency injection     | **Project profile**: one place holding the values that fill the roles. Rules read the role, not the value. |
| Composition root         | **Entry points** that assemble method + adapter + profile into what an agent loads. They route; they do not own facts. |
| Persistent state/data    | **Project state**: plan status, session logs, changelog, review reports. Records that change every session. |
| Single responsibility    | A file or section has one reason to change.                                                                |
| Open/closed              | A new milestone, section, adapter or review is added by adding a file, not by editing a central one.             |
| Liskov                   | Every instance of a document type honors that type's template, so tools and agents can treat them alike.   |
| Interface segregation    | An agent can load a small, task-scoped set of files, not the whole tree.                                   |
| Dependency inversion     | Higher-level text depends on roles and ids, not on concrete tool names, paths or numbers.                   |
| DDD ubiquitous language  | One glossary; one term per concept; the same word in plans, rules, code and UI.                            |
| DDD bounded context      | Product areas (and harness areas) with explicit edges; cross-references go through ids/anchors, not copied text. |
| Aggregate root / SSOT    | Every fact has exactly one owning file; others link to it.                                                  |

### 2.1 Layers and the dependency rule

| Layer       | Name           | Holds                                                           | May reference                       |
| ----------- | -------------- | --------------------------------------------------------------- | ----------------------------------- |
| **CORE**    | Method         | Project- and stack-neutral rules, workflow, templates           | nothing                             |
| **DOMAIN**  | Product        | What the product is, in tool-neutral words                      | nothing (only its own glossary)     |
| **ADAPTER** | Stack          | Tools, commands, hooks, CI, hosting that realize CORE           | CORE (implements), DOMAIN (realizes) |
| **PROFILE** | Configuration  | The values injected into CORE roles; the doc map                | CORE, ADAPTER, DOMAIN               |
| **STATE**   | Instance data  | Plan status, logs, changelog, review reports, archives          | any layer                           |
| **ENTRY**   | Composition    | Agent instruction file, readmes, top-level indexes                     | any layer                           |

**Dependency rule:** references point only in the directions above. CORE never names a tool, a product term or a number
that belongs to a project. DOMAIN never names a framework, test tool, branch, CI job or hosting. A violation is a *leak*.
Two leak types matter most for blueprint readiness: **stack leaks into CORE** and **stack leaks into DOMAIN**.

Tolerated, but counted: a DOMAIN statement of a *binding constraint* ("the sandbox must be a real isolation boundary") is
fine; naming the product that satisfies it belongs in ADAPTER.

---

## 3. Dimensions and scoring

Scale `1` (poor) to `5` (excellent), as in the code review. Each dimension has a question, evidence to collect, and
anchors. A score needs evidence (file and line, or a measured number); a score without evidence is invalid.

### Group A: architecture of the docs

**D1 Layer integrity** (dependency rule). Are layers separable, and do references follow section 2.1?
Evidence: every file and every top-level section classified; leak counts M1, M2; illegal-reference list M3.
`1` layers mixed in the same paragraphs · `3` files mostly in one layer, leaks are known and listed · `5` zero leaks, the check is automated.

**D2 Domain model (DDD)**. Is the product knowledge self-contained, with one ubiquitous language and clear bounded contexts?
Evidence: glossary coverage (terms used but undefined, one concept under two names), cross-context links, duplicated facts M4,
sections that mix two contexts.
`1` terms drift between docs · `3` glossary exists, minor drift · `5` one term per concept, contexts link by id only.

**D3 Injection and parametrization** (DIP/DI). Do rules depend on roles, with values supplied from one profile?
Evidence: injectable values (thresholds, names, paths, versions, tool names) and how many places each appears (M4, M10);
whether a profile exists; whether swapping a stack tool would touch CORE.
`1` values hard-coded everywhere · `3` a profile exists, partly bypassed · `5` every value lives once, rules cite roles.

**D4 Cohesion and responsibility** (S). One reason to change per file and section; sizes sane.
Evidence: size and section-count outliers M6, files that mix layers or document types, sections an edit would force you to
update in more than one file (shotgun edits).
`1` catch-all files · `3` some mixed files · `5` each file has one stated job and one owner.

**D5 Extensibility and contracts** (O, L). Does growth happen by adding files, and do instances honor their template?
Evidence: template conformance M8 for every repeated document type (plan stages, session logs, specification sections, reports); central lists that every new file
must edit (and whether they are generated); extension recipe present.
`1` every addition edits a central file by hand · `3` templates exist, some drift · `5` additions are local, conformance is checked.

**D6 Routing and context economy** (I). Can an agent load only what the task needs?
Evidence: always-loaded size M6 (words and estimated tokens), task-to-files map present, entry points link to deeper files
instead of inlining, orphan files M7.
`1` one monolith must be read in full · `3` an index exists, the always-loaded file is large · `5` small entry point, a reading set per task type.

### Group B: operational quality (does it work)

**D7 Enforceability.** Is each rule backed by a mechanical check, or explicitly marked as judgment?
Evidence: sample normative statements (must, never, "do not"); for each, the hook, CI job, script or review step that enforces
it (M5); rules enforced twice with different thresholds.
`1` rules are prose only · `3` core rules enforced, many unmapped · `5` a rule-to-check map exists and is complete.

**D8 Truth and freshness.** Is it true today?
Evidence: link check result; statuses against git and the repository (plan and task status, existing paths, commands that
exist in the scripts, versions); stale or contradictory statements M9.
`1` known false statements steer agents · `3` minor staleness · `5` drift is caught by checks.

**D9 Clarity and actionability.** Is the instruction unambiguous and executable?
Evidence: cold-start probes M11 (section 4, step 5); contradictions; rules without a decision criterion; examples present.
`1` probes fail or diverge · `3` probes pass with detours · `5` probes pass first time, from the entry point alone.

**D10 State and resumability.** Can work stop and resume from the repository alone?
Evidence: the session protocol exists and is followed; latest work-log entries have a concrete next step and a verify
command; decisions are recorded where the next session looks.
`1` state lives in chat · `3` logs exist, gaps · `5` a cold session resumes from logs without questions.

### Group C: product knowledge integrity

**D11 Product integrity.** Is the product knowledge logically consistent and complete enough to build from?
D2 judges how the knowledge is *organized*; D11 judges whether it is *true to itself*. Check, over the whole corpus:

| Kind               | Question                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| contradiction      | Do two statements exclude each other (a number, a rule, a permission, a state, an order of steps)?                     |
| gap                | Is something used but never defined, a flow without an end or a failure path, a state with no way in or out, a rule with no trigger or actor, an edge case nobody decided? |
| duplication        | Is one rule stated in two places that can diverge?                                                                    |
| invariant          | Does every section respect the cross-cutting invariants (authority over state, determinism, conservation of resources, permissions, ordering)? |
| terminology        | Does one word mean two things, or do two words mean one thing?                                                        |
| status             | Do decided, planned, implemented and open markers agree with each other, with the plan and with the open-questions list? |
| traceability       | Does every requirement reach a plan item and a test, and does every plan item and test point back to a requirement?   |
| feasibility        | Are values within the stated bounds, prerequisite chains free of cycles, sources and sinks of every resource balanced, and stated limits consistent with the stated capacity? |

Evidence: the claims ledger and checks of section 4, step 4b; M12 to M15.
`1` contradictions in core rules, undefined terms in common use · `3` a few known gaps, invariants mostly hold, traceability partial · `5` the ledger shows no open contradiction or gap, traceability is complete and mechanically checked.

**D12 Open items and completeness.** Are all open questions, uncertainties and documentation to-dos registered, owned and
moving, and how complete is the product? D12 is scored on how well open items are *managed*; the completeness
percentages below are *reported measures*, not scores.

An **open item** is anything the knowledge admits it does not settle, in any form: an entry in the open-questions or
uncertainties list, a backlog entry, a to-do, "to be decided" or "unknown" marker, a section marked planned or partial, a
question a gap probe could not answer, a decision recorded only in a log. Review steps:

1. *Register.* Collect every open item from every form and place it in one inventory (section 4, step 4c).
2. *Reconcile declared against hidden.* Compare the inventory with the official list. Open items that exist in the text but
   not in the official list are **hidden**; entries that were resolved but still listed are **stale**. A list that says
   "none" while hidden items exist is a finding.
3. *Classify each item*: kind (needs a decision · needs research · deferred by design · out of scope), whether it **blocks**
   a planned delivery item (and which), age, owner (or none), and the document that would hold the answer.
4. *Evaluate*: blockers of the next delivery milestones first; items older than the cadence; items with no owner; items whose
   only record is a chat or a log.
5. *Measure completeness* with the two percentages and the readiness figure of M16 to M19, always shown together:
   **documented** (how much of the product scope is decided in writing), **delivered** (how much is built and verified), and
   **ready to build next** (the share of the next milestone's items whose specification has no blocking open item).

`1` open items scattered and unregistered, blockers unknown · `3` an official list exists, partial, some hidden items ·
`5` every open item is registered with kind, owner and blocker status, none hidden or stale, percentages reproducible.

### Group D: complexity

**D13 Complexity.** How much must a reader hold in mind to act correctly, and is it justified? Applies to two subjects:
the **harness** (rules, process, documents) and the **product knowledge** (concepts, rules, states, interactions). Complexity
has two parts:

- **Essential**: inherent in the job (the harness must enforce quality; the product has the mechanics it is meant to have). It is
  reported, not penalized.
- **Accidental**: added by how the knowledge is organized or written (duplicated rules, exceptions to exceptions, the same
  concept under several names, deep reference chains, hub files everything depends on, rules whose meaning depends on five other
  rules, process steps that a tool could do). It is what D13 scores.

Dimensions of complexity to evaluate, each as a measured number, a ranked list of hotspots and a judgment of essential versus
accidental:

| Subject  | Aspect              | What is measured                                                                                           |
| -------- | ------------------- | ---------------------------------------------------------------------------------------------------------- |
| Harness  | Rule load           | Number of normative rules in the always-loaded set and per task type; share of rules that carry exceptions or conditions |
| Harness  | Reference structure | Fan-in and fan-out per document; longest chain of documents needed to answer one question; cycles; hub documents |
| Harness  | Process             | Steps, decision points and manual steps in each workflow; number of branch and document types; steps a tool could perform |
| Harness  | Time to first action | Words an agent must read before its first correct action, per scenario (from the cold-start probes)        |
| Product  | Concept load        | Entities, terms, attributes and mechanics per context; mechanics a player must learn per onboarding step    |
| Product  | Rule interaction   | Rules per entity; rules whose condition depends on another rule; longest dependency chain; special cases and exceptions as a share of rules; cycles |
| Product  | State space         | States and transitions of each lifecycle (machines, modules, base, orders, sessions) and combinations that must be specified |
| Product  | Cross-context coupling | References between contexts (in and out per context); contexts that everything depends on or that depend on everything |
| Both     | Growth              | Change of each number since the previous review, against the growth of delivered value                       |

**Budgets.** The first review records the baseline and proposes a budget for each number (a ceiling that a reader can still
hold: for example rules in the always-loaded set, hops to an answer, rules per entity, mechanics per onboarding step). The
budgets are written into `bindings.md` after approval. Later reviews measure against them; exceeding a budget needs a recorded
reason.

Evidence: M20 to M26. Judge each hotspot: can it be simplified without losing a capability (split, merge, delete, move to a
tool, replace several special cases with one rule)? If yes, it is accidental.
`1` complexity unmeasured and visibly beyond a reader's reach · `3` measured, some accidental hotspots, no budget or a budget partly exceeded · `5` budgets exist and are met, hotspots are essential, growth is tracked and justified.

### Blueprint readiness (derived, not a dimension)

A verdict from D1, D3, D4, D6 plus an **export dry run** (section 4, step 6): list what would be copied to a new project
unchanged (CORE), what must be re-implemented (ADAPTER), what the new project must fill (PROFILE), and what is dropped
(DOMAIN, STATE). Report a readiness percentage: words in CORE that are already free of leaks divided by words that
belong in CORE. Also list the **extraction blockers**.

### Targets and gates

Targets: every dimension `4`, D1, D3 and D7 `5` before the blueprint is extracted. A review fails its gate when any
dimension is `1` or `2`, or when D8, D9 or D11 contains a finding that makes an agent or a builder act wrongly (🔴), or when D12 shows a hidden open
item that blocks the next milestone.

---

## 4. Procedure

Work on a documentation-type branch cut from the integration branch, named after the review date. The review is **read-only
for the harness**: it adds one report (and updates the indexes that link to it). Fixes are separate pull requests after the
report is approved.

1. **Prepare.** Record the commit under review (`git rev-parse --short HEAD`) and the previous review's scores. Read
   [`bindings.md`](./bindings.md). Prefer a reviewer who did not write the harness (a fresh agent session or a subagent
   given only this folder); say in the report who reviewed.
2. **Inventory and classify.** List every harness file, and for large entry points each top-level section; assign a layer
   (section 2.1) and a document type. Compare with the table in `bindings.md` and update it in the report. A file or section
   that fits no layer, or fits two, is a D1/D4 finding.
3. **Measure.** Run the measurements of `bindings.md` and record the numbers in the report (M1 to M10, M12 to M26). Quote the command and
   the date so the run can be repeated. Measurements are evidence, not verdicts: a hit is judged in context.
4. **Review by dimension.** Go through D1 to D13, collect evidence, write findings (section 5), then score.
   - **4b. Product integrity pass (D11).** Treat the product knowledge as a system to be checked, not text to be skimmed:
     1. *Partition* the corpus into bounded contexts (`bindings.md` lists them). A full review reads **every** section; record
        coverage (sections read of total). A delta review reads the changed sections and every section that references them.
     2. *Extract a claims ledger* per context, keyed by section id: entities and attributes, states and transitions, rules
        (actor, trigger, condition, effect), numbers and limits with units, flows and their failure paths, permissions,
        events, resources with their sources and sinks, cross-references, and decision status. The ledger is a working
        file in the scratchpad; it is evidence for the report, not a deliverable to commit. Contexts may be extracted in
        parallel by read-only subagents, each also reporting its own intra-context findings.
     3. *Check within a context*: every kind of the D11 table, pairwise over the ledger.
     4. *Check across contexts* by joining ledgers on shared entities, numbers and cross-references; test every cross-cutting
        invariant (`bindings.md`) against every context; run the mechanical checks (unresolved references, undefined terms,
        status and traceability joins).
     5. *Probe gaps by building*: for a planned feature, write the list of questions a builder would have to ask
        that the knowledge does not answer (probe P6).
     6. *Report only provable findings*: a contradiction quotes **both** statements with their locations; a gap states the
        exact question the knowledge cannot answer; a feasibility finding shows the arithmetic. Anything that depends on taste
        is dropped.
   - **4c. Open-item inventory and completeness (D12).** Build the inventory of section 3 (D12) as a table with one row per
     open item: id, location, form, kind, blocks (plan item or none), age, owner, declared (yes or hidden or stale). Search every
     form with the patterns in `bindings.md`, read the official lists in full, and add the items the gap probes and the claims
     ledger surfaced. Then compute M16 to M19. Do not decide open items during the review; list them with the question that
     must be answered and the owner who can answer it.
   - **4d. Complexity pass (D13).** After 4b and 4c, so that the claims ledger exists; compute M20 to M25 here and M26 after the probes of step 5.
     Rank the hotspots in each aspect; classify each as essential or accidental with the reason; propose the simplification for
     each accidental one (split, merge, delete, automate, unify); on the first review, propose the budgets. Do not simplify
     anything during the review.
5. **Cold-start probes.** Run the scenarios of `bindings.md` with fresh, read-only subagents that receive only the task text
   and the repository (no conversation context). Record the files each read, the first action it took, and any wrong or
   uncertain step. A probe is evidence for D6, D9 and D10. Never fix a document during a probe.
6. **Export dry run.** Perform the blueprint exercise of section 3 on paper: classify, list the parameters a new project
   would have to supply, and name the blockers.
7. **Report.** Fill [`_template.md`](./_template.md) as `YYYY-MM-DD.md` in this folder; if two reviews happen
   on one day, add `-2`. Link it from the indexes in `bindings.md`. Compare with the previous report (trend table).
8. **Follow-up.** After approval, turn findings into work: 🔴 and 🟠 become tasks in the delivery plan or a dedicated
   documentation change; 🟡 and 🔵 go to the backlog. Record the resulting tasks in the report's follow-up table.

---

## 5. Findings

One finding per problem, so it can become one task.

| Field          | Content                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------- |
| ID             | `H-<YYYYMMDD>-<nn>`                                                                           |
| Severity       | 🔴 an agent or builder acts wrongly, a rule is false, or two core rules contradict · 🟠 blocks blueprint extraction, wastes major context, or leaves a planned feature unbuildable without a decision · 🟡 maintainability · 🔵 polish |
| Dimension      | D1 to D13                                                                                     |
| Kind (D11)     | contradiction · gap · duplication · invariant · terminology · status · traceability · feasibility |
| Kind (D12)     | hidden open item · stale open item · unowned · blocker · unregistered decision                   |
| Kind (D13)     | hub · deep chain · cycle · exception-heavy rule · concept overload · duplicated mechanism · automatable step · budget exceeded |
| Evidence       | `path:line` or the measured number; for a contradiction, both statements with locations; for a gap, the unanswerable question |
| Why it matters | The concrete failure for an agent, a maintainer or the export                                 |
| Fix            | The smallest change that removes it, naming the target layer and file                         |
| Effort         | S (under an hour) · M (a session) · L (several sessions)                                      |
| Export impact  | blocker · helps · none                                                                        |

Rules: cite evidence for every claim; prefer a few well-evidenced findings over many vague ones; do not report taste as
defects; do not propose a fix that creates a new leak; note what is already good (a "keep" list), so a later cleanup
does not undo it.

---

## 6. Cadence

| When                                                                                  | Review type                                   |
| ------------------------------------------------------------------------------------- | --------------------------------------------- |
| First review, and before extracting the blueprint                                     | **Full**: all dimensions, probes, dry run     |
| End of each plan milestone                                                    | **Delta**: layers touched since the last report, D8, D10, one probe |
| Product knowledge changed (sections added or edited)                                  | **Delta D11**: changed sections plus their referrers, all invariants, traceability |
| End of each plan milestone and before starting the next                              | **Delta D12**: refresh the inventory and M16 to M19, report the trend of the percentages |
| End of each plan milestone                                                           | **Delta D13**: refresh M20 to M26 and compare with the budgets and the previous report |
| After a large change to an entry point, the hooks, CI, or the layer structure          | **Delta** on the affected dimensions          |
| A probe or a real session shows an agent misreading the harness                         | **Targeted**: the failing scenario and the owning document |

A delta report states which dimensions it did not re-score and carries their previous scores forward, marked as carried.

---

## 7. Keeping this method healthy

- The method (this file) must stay project-neutral: a repository term here is a CORE leak. Put it in `bindings.md`.
- When a review shows a measurement or dimension was unusable, change the method in the same pull request and add a line to the
  method changelog below, so scores stay comparable across reviews.
- Prefer automating a measurement (a script run by the CI) once the same check has been run by hand twice.

### Method changelog

| Date       | Change                                                  |
| ---------- | ------------------------------------------------------- |
| 2026-10-15 | First version: layers, dimensions D1–D10, procedure.    |
| 2026-10-15 | Product knowledge integrity (D11, claims ledger, M12–M15) added to scope. |
| 2026-10-15 | Open items and completeness (D12, M16–M19) added: inventory, declared against hidden, documented and delivered percentages. |
| 2026-10-16 | Complexity (D13, M20–M26) added for the harness and the product knowledge: essential versus accidental, hotspots, budgets set from the first baseline. |

### Measurements (M1 to M26) in one line each

| Id  | Measurement                                                                                  |
| --- | -------------------------------------------------------------------------------------------- |
| M1  | Stack terms inside CORE and DOMAIN files (count, per 1000 words)                              |
| M2  | Product terms inside CORE files                                                              |
| M3  | References that break the dependency rule (list)                                             |
| M4  | Facts and values that appear in more than one file (list, owner chosen)                      |
| M5  | Normative statements with a mechanical check, with a judgment-only mark, with neither (sample) |
| M6  | Words and sections per file; words in always-loaded files                                    |
| M7  | Link check result; files not reachable from any index                                       |
| M8  | Share of instances (plan stages, logs, sections) that match their template                       |
| M9  | Statements contradicted by the repository or by another document (list)                      |
| M10 | Injectable values: hard-coded places versus profile                                          |
| M11 | Cold-start probe results                                                                     |
| M12 | Claims-ledger coverage: sections read of total, claims extracted per context                 |
| M13 | Contradictions and gaps found, by kind and context                                           |
| M14 | Traceability: requirements without a plan item or test; plan items and tests without a requirement |
| M15 | Unresolved cross-references and undefined terms (mechanical)                                 |
| M16 | Open-item inventory: count by form, kind, blocker status, age, owner; declared, hidden and stale counts |
| M17 | **Documented %**: decided share of the product scope (formula in `bindings.md`)               |
| M18 | **Delivered %**: built-and-verified share of the product scope and of the plan                |
| M19 | **Ready to build next %**: items of the next milestone whose specification has no blocking open item |
| M20 | Harness rule load: normative rules in the always-loaded set and per task type; share with exceptions |
| M21 | Harness reference structure: fan-in and fan-out per document, longest chain, cycles, hubs     |
| M22 | Harness process: steps, decision points and manual steps per workflow; automatable steps       |
| M23 | Product concept load: entities, terms, attributes and mechanics per context; mechanics per onboarding step |
| M24 | Product rule interaction: rules per entity, dependent rules, longest chain, exception share, cycles |
| M25 | Product state space and cross-context coupling: states and transitions per lifecycle; references in and out per context |
| M26 | Time to first action: words read before the first correct action, per probe scenario          |
