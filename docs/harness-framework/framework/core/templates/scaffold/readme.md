# {{project.title}}

{{project.product}}

## Working on this repository

- The rules for agents and people: [{{paths.entryFile}}]({{rel:paths.entryFile}}).
- Every value of the harness: the [project profile]({{rel:paths.profileDocument}}), generated from `{{paths.profileFile}}`.
- The development plan: the [plan index]({{rel:paths.planIndex}}).
- The harness is a copy of the framework in `harness/`, recorded in `harness.lock.json`. `{{commands.docsCheck}}` runs every check of the
  framework, and `{{commands.harnessSyncLocal}}` regenerates the managed files after a change of the profile file.
