# Changelog

All notable changes to the framework are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/), and the
versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- The skeleton of the framework: the folders of the layout, `framework.json` at `0.1.0-dev`, the MIT license, this changelog and the
  README. The core documents, the tools and the adapters follow in the build tasks of the design.
- Vendoring (design §1): `harness sync` (from a folder or a Git tag, with the selected adapters only), `sync --local`, `check vendored`,
  `diff`, `override` and `detach`, with `harness.lock.json` in the modes `pinned`, `detached` and `self`. Plain Node, no dependencies.
- The generic tools (design §3.4), merged from both copies that existed: `check all`, `check links` (anchors keep `_` as the host does),
  `check paths` (new), `check core`, `check plan` with `plan summary` and `plan log`, `check changelog` with `release` and `release notes`,
  `check product-knowledge` (its file names and exceptions in the profile's `productKnowledge`), and `ci changes` with
  `checks.documentationPaths`. The profile gains `checks`, `productKnowledge`, `release` and `paths.entryFile`.
