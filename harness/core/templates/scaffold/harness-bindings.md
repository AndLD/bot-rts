[← Harness review method]({{rel:documents.harnessReviews}})

# Harness review bindings

The values of the [harness review method]({{rel:documents.harnessReviews}}) for {{project.title}}: its layers, measurements, bounded
contexts, budgets and cold-start probes (section 4 of the method). The first harness review writes them; until then this file holds what the
tools already know.

- **Values:** the [project profile]({{rel:paths.profileDocument}}), with the term lists of the CORE scan (its section 9).
- **Checks:** `{{commands.docsCheck}}` runs every check of the framework.
- **Reports:** one dated file per review next to this one, from the report template of the method.

{{#if layers}}
## Layers

<!-- harness:begin layers -->
<!-- harness:end layers -->
{{/if}}
