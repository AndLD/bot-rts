# Quality reviews

Point-in-time reviews of the project's quality. Each kind has its own method (project-neutral), the repository's values for it
(`bindings.md`), a report template and the dated reports.

| Review | What it assesses | Method | Reports and values |
| ------ | ---------------- | ------ | ------------------ |
| **Code** | The source code against the declared quality bar: architecture, SOLID, tests, testability, scalability, maintainability, security, errors, dependencies, delivery gates | [code/README.md](./code/README.md) | the project's `bindings.md` of the review (values and review log) |
| **Harness** | The documentation and AI harness: layering of the docs, product knowledge integrity and completeness, enforceability, resumability, blueprint readiness | [harness/README.md](./harness/README.md) | the project's `bindings.md` of the review (values and review log) |
| **Security** | The project's exposure, in the code and beyond it: secrets, dependencies and supply chain, the CI and the repository host, the agent harness, the product's attack surface, operations | [security/README.md](./security/README.md) | the project's `bindings.md` of the review (values, scope of active tests and review log) |

All follow the same rhythm: prepare, measure, assess, report with findings, then fix in separate pull requests. A review changes
nothing but its own report and the indexes that link to it (a security review may also run the active tests that its rules of engagement allow).

New reports are named `YYYY-MM-DD.md` inside the folder of their kind and listed in the review log of that kind's bindings, which this index links.
