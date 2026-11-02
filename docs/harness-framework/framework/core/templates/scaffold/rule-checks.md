[← {{paths.entryFile}}]({{rel:paths.entryFile}})

# Rule-to-check map

Which mechanism holds each rule of the entry file, and at which moment: early (the agent runtime, before the action), local (the Git hooks
and the push gate) or remote (the host and CI). The rows of the core rules are generated from the adapters of the profile and rewritten by
`{{commands.harnessSyncLocal}}`; the rows of this project's own rules go below the block.

<!-- harness:begin rule-map -->
<!-- harness:end rule-map -->
