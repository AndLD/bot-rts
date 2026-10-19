[← Changelog](../CHANGELOG.md)

# Changelog fragments

A pull request that changes what a player, an API client or an operator sees adds **one file here** instead of a line in the shared
"Unreleased" list, so that two pull requests never edit the same lines. A release (`scripts/release.mjs`, see
[`RELEASING.md`](../../operations/RELEASING.md)) moves the fragments into the section of the version and deletes them.

- **Name:** `<plan task>-<slug>.md`, for example `10.4-order-book.md`.
- **Text:** `<Kind>: <entry>`, where the kind is `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed` or `Security`. The entry is one
  paragraph that may go on over several lines.
- **Check:** the documentation check fails on a fragment that does not start with a kind.
