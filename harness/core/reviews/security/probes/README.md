[← Security review method](../README.md)

# The catalogue of probes

**First edition (2026-11-08), and a draft.** It was researched from the named sources by agents, not by a security specialist. It stays a draft until a person with security expertise has reviewed it, and the review log of the project's bindings records who did. It is a starting point: a probe that passes does not prove the project safe, and a weakness that no probe names is still a finding (section 9 of the method says how the catalogue grows).

Each probe has the format of section 3 of the method. The playbooks of attack scenarios are in [`scenarios/`](../scenarios/README.md), and the procedure for the threat model of S5 and S6 is [`threat-model.md`](../threat-model.md).

| Dimension | File | Probes | Scriptable | Judged | Manual |
| --------- | ---- | ------ | ---------- | ------ | ------ |
| S1 Secrets | [S1-secrets.md](./S1-secrets.md) | 21 | 6 | 15 | 0 |
| S2 Dependencies and supply chain | [S2-dependencies-supply-chain.md](./S2-dependencies-supply-chain.md) | 22 | 8 | 13 | 1 |
| S3 CI and the repository host | [S3-ci-repository-host.md](./S3-ci-repository-host.md) | 22 | 7 | 10 | 5 |
| S4 Agent harness | [S4-agent-harness.md](./S4-agent-harness.md) | 26 | 4 | 20 | 2 |
| S5 The product's attack surface | [S5-attack-surface.md](./S5-attack-surface.md) | 44 | 4 | 40 | 0 |
| S6 Operations | [S6-operations.md](./S6-operations.md) | 13 | 0 | 12 | 1 |

## Project traits

The value `project: <trait>` of the field Applies names what a project has. Several traits mean that the probe applies when the project has all of them. The reviewer decides each from the repository and lists in the report what it found.

| Trait | The project … |
| ----- | ------------- |
| agent-runtime | is worked on by an AI coding agent |
| auto-merge | merges by auto-merge, a queue or a bot |
| builds-artifacts | builds container images or release archives |
| ci | has a CI |
| consumes-provenance | fetches artifacts that carry a signature or provenance |
| dependencies | has dependencies of a package manager |
| deploys | has deployment manifests or infrastructure as code |
| environment-file | reads environment variables from a file |
| fetches-tools | downloads tools at run time |
| holds-secrets | has at least one secret of its own |
| hooks | ships hooks of its agent runtime |
| host-push-protection | is on a host that can block pushes that hold secrets |
| multi-agent | delegates to subagents or several agents |
| outside-contributions | takes pull requests from forks or outside collaborators |
| past-secret-finding | has ever found a secret in its repository |
| private-packages | uses private packages or a private registry |
| releases | publishes a package, an image or tagged releases; a tag with notes and no built artifact is `releases` without `builds-artifacts` |
| self-hosted-runners | runs CI on its own runners |
| tool-servers | connects its agents to tool servers |
| unattended-agent | starts an agent from CI or another automation |
| vendored | keeps a vendored or synced copy of a framework or a tool tree |

## Kinds of product

The value `product: <kinds>` of the field Applies names what the product is; several kinds mean all of them. The threat model in the bindings says which apply. A project adds a kind of its own there, for the probes of its own.

| Kind | The product … |
| ---- | ------------- |
| accounts | has user accounts and a login |
| consumes-apis | calls third-party services |
| fetches-urls | fetches an address that comes from input |
| file-handling | takes uploads or serves files from users |
| http-api | exposes an HTTP API |
| mfa | offers a second factor |
| multi-user | holds data or roles that differ between users or tenants |
| passwords | authenticates with passwords |
| service | runs as a service that others reach |
| sso | logs in through an identity provider |
| untrusted-code | runs code or content from users or models |
| user-data | stores other people's data |
| web | serves pages to a browser |

## Host and runtime

A probe names what to look at in terms that fit any host and any agent runtime. The name of the feature on a given tool, and the pages of its documentation that the source ids `HOST-DOCS` and `RUNTIME-DOCS` stand for, are in a file `security.md` in the folder of the adapter. Where an adapter has no such file, the reviewer reads the documentation of the tool, and says so in the report's section on the method.

## How the sources were used

The text of a source is summarized and cited by its id, never copied. Each dimension's file ends with the table of its sources. A date beside a citation is the last day that source was read for that probe. Where a clause of a probe has no outside source, the probe says so. The NIST framework is cited in its final version, and the changes of its draft revision were read.
