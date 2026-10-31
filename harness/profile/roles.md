[← README]({{rel:documents.readme}}) · rules: {{link:documents.rules}}

# Project profile

Every injectable value of this project's harness, named by its **role**. Rules elsewhere cite the role ("the coverage gate",
"the integration branch") and link here; they do not repeat the value.

**This document is generated** from [`{{paths.profileFile}}`]({{rel:paths.profileFile}}) and the template `profile/roles.md` of the
framework. To change a value, change it in the file and run `{{commands.harnessSyncLocal}}`; never edit this document by hand.
`{{commands.docsCheck}}` fails when the file, this document and `harness.lock.json` disagree. The hooks and scripts read the file through
`harness profile get <role>`. A role that has no value in the file is left out of this document.

The method documents keep their own `bindings.md` (plan, phases, code review, harness review). A binding that needs a value
below links to its row instead of copying it.

---

## 1. Project

| Role | Value |
| ---- | ----- |
| Project name | `{{project.name}}` ({{project.title}}) |
| Product | {{project.product}} |
| Repository | `{{repository.slug}}` on {{repository.host}} |
| Packages | {{project.packages}} |
| Agent entry file | {{project.entryFile}} |
| Framework and its adapters | `harness/`, a copy of `harness-framework` pinned by `harness.lock.json` ({{project.frameworkSource}}); adapters {{derived.adapters}} |
| Owner | {{project.owner}} |

## 2. Quality gates

| Role | Value | Mechanism |
| ---- | ----- | --------- |
| **Coverage gate** | **{{derived.coverageGate}}** | {{quality.coverageMechanism}} |
| Coverage gate scope | {{quality.coverageScope}} | {{quality.coverageScopeMechanism}} |
| Coverage exclusions | {{quality.coverageExclusions}} | `collectCoverageFrom` |
| Local gate | {{quality.localGate}} | {{quality.localGateMechanism}} |
| **Required checks** (the merge gates) | {{derived.requiredChecks}}; jobs of the host's CI workflow | {{quality.requiredChecksMechanism}} |

## 3. Branches and merging

| Role | Value |
| ---- | ----- |
| **Production branch** | `{{branches.production}}`; {{branches.productionNote}} |
| **Integration branch** | `{{branches.integration}}`; {{branches.integrationNote}} |
| Protected branches | the production and the integration branch |
| Branch retention | {{branches.retention}} |

Branch types:

| Type | Name | Purpose | Branched from | Merges into | Merge strategy |
| ---- | ---- | ------- | ------------- | ----------- | -------------- |
| feature | `feature/<id>-<slug>` | new work | integration | integration | squash merge |
| bugfix | `bugfix/<id>-<slug>` | non-release fixes | integration | integration | squash merge |
| docs | `docs/<slug>` | documentation-only changes | integration | integration | squash merge |
| chore | `chore/<slug>` | tooling, CI, dependencies, config | integration | integration | squash merge |
| release | `release/<x.y.z>` | release stabilization (fixes only) | integration | production **and** integration | merge commit |
| hotfix | `hotfix/<x.y.z>` | urgent production fix | production | production **and** integration | merge commit |

`<id>` is a plan task id (section 4); a docs or chore branch that implements a plan task may carry it too
(`docs/15.1-project-profile`). A squash merge produces one Conventional Commit per pull request; a merge commit keeps release history traceable.

| Role | Value |
| ---- | ----- |
| Commit format | [Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`, optional scope in parentheses, `!` and a `BREAKING CHANGE:` footer for breaking changes |
| Plan reference in a commit | a `Plan: <task id>` line in the body |
| Pull-request title | the squash commit's message, checked by the CI job `pr-title` |

## 4. Plan

| Role | Value |
| ---- | ----- |
| Plan index | {{link:paths.planIndex}} |
| Milestone | a phase, one file `{{paths.phases}}/phase-<n>-<slug>.md` |
| Task id | {{plan.taskId}} |
| Session log | `{{paths.phases}}/work-logs/phase-<n>-log.md`, one per phase, append-only: the phase-wide entries (decisions before the start, pauses) |
| Phases with per-task records | {{plan.phasesWithFragments}} |
| Phases with one log | {{plan.phasesWithOneLog}} |
| Plan-log command | {{plan.logCommand}} |
| Implementation log | printed from the merged pull requests by the plan-log command (the `Plan: <task id>` lines of the squash commits); the phases with one log keep the table written in the phase file |
| Task claim | a draft pull request titled `chore(plan): claim task <task id>` with `Plan: <task id>` in the body, opened before any other work on the task |
| Status symbols | ⬜ not started · 🟡 in progress · ✅ done |
| Estimation scale | {{plan.estimationScale}} |
| Resume phrases | {{plan.resumePhrases}} |
| Open-ended phase | {{plan.openEndedPhase}} |
| Specification citation | {{plan.specificationCitation}} |
| Agent complexity | every open task carries a marker in the `Agent` column of its phase file: {{derived.complexityScale}} |
| Agent models | {{derived.complexityModels}} |

{{#if api}}
## 5. Public API

| Role | Value |
| ---- | ----- |
| **API prefix** | {{api.prefix}} |
| Versioning policy | {{api.versioning}} |
| API description | {{api.description}} |

{{/if}}
{{#if languages}}
## 6. Languages

| Role | Value |
| ---- | ----- |
| **User-facing languages** | {{languages.userFacing}} |
| Message catalogues | {{languages.catalogues}} |
| Language of the harness and the design documents | {{languages.harness}} |

{{/if}}
## 7. Runtime versions

| Role | Value |
| ---- | ----- |
| Language | {{versions.language}} |
| Runtime | {{versions.runtime}} |
| Database | {{versions.database}} |

## 8. Commands

Run from the repository root unless a package is named.

| Role | Command |
| ---- | ------- |
| Lint (ESLint of every package and the Prettier check) | `{{commands.lint}}` |
| Format | `{{commands.format}}` |
| Typecheck | `{{commands.typecheck}}` |
| Unit and integration tests | `{{commands.test}}` (needs `{{commands.dbUp}}`) |
| Tests with the coverage gate | `{{commands.testCoverage}}` |
| Changed-file coverage | `{{commands.changedCoverage}}` (after `{{commands.testCoverage}}`) |
| Import boundaries | `{{commands.boundaries}}` |
| Message catalogues | `{{commands.i18n}}` |
| Every check of the framework (`harness check all`): the vendored copy, the profile file, the layer map, links, backticked paths, the CORE scan, the plan summary, the changelog fragments and the product knowledge | `{{commands.docsCheck}}` |
| Take the framework again from its source into `harness/`; regenerate the managed files only; show a local change of `harness/` | `{{commands.harnessSync}}`; `{{commands.harnessSyncLocal}}`; `{{commands.harnessDiff}}` |
| Build | `{{commands.build}}` |
| End-to-end tests | `{{commands.e2e}}` |
| Regenerate the API description | `{{commands.openapi}}` |
| Regenerate the web client's API layer | `{{commands.apiClient}}` |
| Start the local database (and Redis) | `{{commands.dbUp}}` |
| Apply migrations to the local database | `{{commands.dbMigrate}}` |
| Seed the local database | `{{commands.dbSeed}}` |
{{#if release}}

A release (`harness release`, on a release or hotfix branch) sets the version of {{release.versionFiles}}, and then runs `{{release.lockCommand}}`.
{{/if}}

## 9. Review values

The harness review's term lists (M1, M2 of its method) and the bounded contexts of the product knowledge.

Stack terms (case-insensitive), which must not appear in CORE or DOMAIN text:

```bash
STACK='{{terms.stack}}'
```

Product terms, which must not appear in CORE sections (the CORE scan skips the generic words below):

```bash
PRODUCT='{{terms.product}}'
```

Generic words of the product list, judged in context and not scanned in CORE text:

```bash
PRODUCT_GENERIC='{{terms.productGeneric}}'
```

Project values, which must not appear in CORE text except on the **Role binding** line of `AGENTS.md` (the CORE scan of
`{{commands.docsCheck}}` reads this list from the profile file; the CORE files are listed in the [harness bindings]({{rel:documents.harnessBindings}})):

```bash
PROJECT_VALUES='{{terms.projectValues}}'
```

{{#if productKnowledge}}
The product-knowledge check (`harness check product-knowledge`, part of `{{commands.docsCheck}}`) reads the product specification in
`{{productKnowledge.specification}}/`: its glossary `{{productKnowledge.glossary}}`, its register of open items `{{productKnowledge.register}}` and its backlog `{{productKnowledge.backlog}}`.
A line may point to the backlog by its section, §{{productKnowledge.backlogSection}}.
It scans `{{productKnowledge.root}}/` for stack terms, plan references and code paths (`{{productKnowledge.implementationPattern}}`), except `{{productKnowledge.excluded}}`.
A file keeps the stack terms that are part of its product: `productKnowledge.allowedTerms` of the profile file.

{{/if}}
{{#if contexts}}
Bounded contexts (files of the product specification):

| Context | Sections |
| ------- | -------- |
{{#each contexts}}
| {{name}} | {{sections}} |
{{/each}}

{{/if}}
## 10. Document map

| Role | Document |
| ---- | -------- |
| Agent rules (always loaded) | {{link:documents.rules}} |
| Engineering method (read on demand) | {{link:documents.method}} |
| Stack, layering, conventions (read on demand) | {{link:documents.stack}} |
| Architecture decisions (read on demand) | {{link:documents.architecture}} |
| Rule-to-check map (read on demand) | {{link:documents.ruleChecks}} |
| Project profile | this file |
| Project overview, setup, environment variables | {{link:documents.readme}} |
| Product specification | {{link:documents.specification}} |
| Glossary | {{link:documents.glossary}} |
| Public API contract | {{link:documents.apiContract}}, {{link:documents.mcpContract}} |
| Changelog | {{link:documents.changelog}}; entries of unreleased changes are fragments in {{link:documents.changelogFragments}}, collected by the release script |
| Plan index | {{link:paths.planIndex}} |
| Plan method and its values | {{link:documents.planMethod}}, {{link:documents.planBindings}} |
| Definition of done | {{link:documents.definitionOfDone}} |
| Guiding principles | {{link:documents.guidingPrinciples}} |
| Testing guide, e2e matrix | {{link:documents.testing}}, {{link:documents.e2eMatrix}} |
| Deployment and releases | {{link:documents.deployment}}, {{link:documents.releasing}} |
| Code quality reviews | {{link:documents.codeReviews}} |
| Harness quality reviews | {{link:documents.harnessReviews}}, {{link:documents.harnessBindings}} |
| Harness-to-framework plan | {{link:documents.frameworkPlan}} |
