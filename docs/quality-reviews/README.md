[← README](../../README.md)

# Quality reviews

Point-in-time reviews of the project's quality. Each kind has its own method (project-neutral), the repository's values for it
(`bindings.md`), a report template and the dated reports.

| Review | What it assesses | Method | Reports |
| ------ | ---------------- | ------ | ------- |
| **Code** | The source code against the declared quality bar: architecture, SOLID, tests, testability, scalability, maintainability, security, errors, dependencies, delivery gates | [code/README.md](./code/README.md) | [2026-10-10](./code/2026-10-10.md) (historical, old prototype) |
| **Harness** | The documentation and AI harness: layering of the docs, product knowledge integrity and completeness, enforceability, resumability, blueprint readiness | [harness/README.md](./harness/README.md) | none yet |

Both follow the same rhythm: prepare, measure, assess, report with findings, then fix in separate pull requests. A review changes
nothing but its own report and the indexes that link to it.

New reports are named `YYYY-MM-DD.md` inside the folder of their kind and listed in the table above.
