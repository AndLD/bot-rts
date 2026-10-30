#!/usr/bin/env bash
# Protects the production and the integration branch (AGENTS.md §7.3; their names and the repository are in harness-profile.json)
# with a repository ruleset and keeps merged branches. The required checks are in the same file (requiredChecks). Needs repository admin rights, and a public repository or a paid GitHub plan.
# Rules: no deletion, no force-push, every change through a pull request, required jobs green. Repository admins may bypass the
# rules only when merging a pull request (for example past a red check), never with a direct push.
# Usage: scripts/protect-branches.sh [owner/repo]
set -euo pipefail

# A value of the profile file, by role
profile_get() { node "$(dirname "$0")/../harness/tools/harness.mjs" profile get "$1" --root "$(dirname "$0")/.."; }

repo="${1:-$(profile_get repository.slug)}"
production=$(profile_get branches.production)
integration=$(profile_get branches.integration)
name="protected-branches"
# One {"context": "<job>"} entry per required check of the profile file
checks=$(profile_get requiredChecks | sed 's/.*/{ "context": "&" }/' | paste -sd, -)

gh api -X PATCH "repos/${repo}" -F delete_branch_on_merge=false >/dev/null

ruleset=$(cat <<JSON
{
  "name": "protected-branches",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/${production}", "refs/heads/${integration}"], "exclude": [] } },
  "bypass_actors": [{ "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "pull_request" }],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [${checks}]
      }
    }
  ]
}
JSON
)

id=$(gh api "repos/${repo}/rulesets" --jq ".[] | select(.name == \"${name}\") | .id")
if [ -n "$id" ]; then
  echo "$ruleset" | gh api -X PUT "repos/${repo}/rulesets/${id}" --input - >/dev/null
else
  echo "$ruleset" | gh api -X POST "repos/${repo}/rulesets" --input - >/dev/null
fi
echo "Ruleset ${name} applied to ${production} and ${integration} in ${repo}"

# The ruleset replaces the classic branch protection, which cannot exempt admins from the checks without also letting them push
for branch in "$production" "$integration"; do
  gh api -X DELETE "repos/${repo}/branches/${branch}/protection" >/dev/null 2>&1 && echo "Removed the classic protection of ${branch}" || true
done
