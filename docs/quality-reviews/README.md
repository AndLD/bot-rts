[← README](../../README.md)

# Quality reviews

Point-in-time reviews of the project's quality. Each kind has its own method (project-neutral), the repository's values for it
(`bindings.md`), a report template and the dated reports.

| Review | What it assesses | Method | Reports and values |
| ------ | ---------------- | ------ | ------------------ |
| **Code** | The source code against the declared quality bar: architecture, SOLID, tests, testability, scalability, maintainability, security, errors, dependencies, delivery gates | [code/README.md](./code/README.md) | [bindings.md](./code/bindings.md#7-review-log) (values and review log) |
| **Harness** | The documentation and AI harness: layering of the docs, product knowledge integrity and completeness, enforceability, resumability, blueprint readiness | [harness/README.md](./harness/README.md) | [bindings.md](./harness/bindings.md#4-review-log) (values and review log) |

Both follow the same rhythm: prepare, measure, assess, report with findings, then fix in separate pull requests. A review changes
nothing but its own report and the indexes that link to it.

New reports are named `YYYY-MM-DD.md` inside the folder of their kind and listed in the review log of that kind's bindings, which this index links.
