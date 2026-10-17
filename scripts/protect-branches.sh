#!/usr/bin/env bash
# Protects `main` and `develop` (AGENTS.md §7.3) and keeps merged branches. Needs repository admin rights, and a public
# repository or a paid GitHub plan (branch protection is unavailable for private repositories on the free plan).
# Usage: scripts/protect-branches.sh [owner/repo]
set -euo pipefail

repo="${1:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"

gh api -X PATCH "repos/${repo}" -F delete_branch_on_merge=false >/dev/null

for branch in main develop; do
  gh api -X PUT "repos/${repo}/branches/${branch}/protection" --input - >/dev/null <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["verify", "pr-title", "e2e", "lighthouse"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": false
}
JSON
  echo "Protected ${branch} in ${repo}"
done
