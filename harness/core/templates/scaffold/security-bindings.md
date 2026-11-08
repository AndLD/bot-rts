[← Security review method]({{rel:documents.securityReviews}})

# Security review bindings

The values of the [security review method]({{rel:documents.securityReviews}}) for {{project.title}}: what applies, the threat model, the scope of active tests, this
project's own probes and the review log. The first security review fills them; until then this file holds what the tools already know.

- **Values:** the [project profile]({{rel:paths.profileDocument}}).
- **Reports:** one dated file per review next to this one, from the report template of the method.

## What applies

<!-- S1 to S4 apply to every project. S5 and S6 are "not applicable", with the reason, where the project has no product runtime. Also list here each probe of the catalogue that does not fit this project, with the reason. -->

| Dimension or probe | Applies | Reason when it does not |
| ------------------ | ------- | ----------------------- |
| S1 to S4 | yes | — |
| S5 | — | — |
| S6 | — | — |

## Threat model

<!-- S5 and S6: the procedure is the file threat-model.md beside the method. The kinds of product (the words the `Applies` field of a probe uses) are listed in the index of the probes; a project adds its own here. An agent drafts it from the project's code and documents; a person checks it. -->

## Scope of active tests

<!-- The rules of engagement of the method (section 5). No scenario runs while this table is empty. Only the owner of the project widens it, before the run. Never production and never a third party's system. -->

| Item | Value |
| ---- | ----- |
| Environments and their addresses | — |
| Accounts and data to use (test only) | — |
| Tools allowed | — |
| Limits for scenarios (requests, sizes, test mail domain, listener) | — |
| Out of scope | production, every system of a third party |
| Approved by, on | — |

## Private place for findings

<!-- Where the details of an open exploitable finding go while the repository can be read by more people than those who fix it (the method, section 7). -->

## Probes of this project

<!-- In the format of the method (section 3), with ids `P-<dimension>-<nnn>`. -->

## Review log

The catalogue of probes was reviewed by a person with security expertise: — (who, and when; until then it is a draft).

| Report | Type | Findings (🔴 / 🟠 / 🟡 / 🔵) |
| ------ | ---- | ---------------------------- |
