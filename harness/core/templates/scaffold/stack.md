[← README]({{rel:documents.readme}})

# Stack

The tools of this project and how its code is laid out. The adapters of the framework fill the roles of the method; this file says what the
project adds to them. Keep each section short, and link the documents that hold the details.

## 1. Tech stack and test tooling

The stack adapters of the profile: {{scaffold.stacks}}.

{{#if scaffold.firstSteps}}
Done once, by hand, after the bootstrap:

{{scaffold.firstSteps}}
{{/if}}

## 2. Architecture and layering

The packages, their layers and the direction of their imports.

## 3. Conventions

Naming, errors, logging, and the typed constants that replace magic strings.

## 4. Test tooling

The test runner, the coverage tool and the fixtures of each package.

## 5. Definition of done: stack items

The checks of the stack that [method §4]({{rel:documents.method}}#4-definition-of-done) adds to the definition of done.

## 6. Agent runtime

The agent-runtime adapters of the profile: {{scaffold.runtimes}}. The repository host: {{scaffold.host}}.
