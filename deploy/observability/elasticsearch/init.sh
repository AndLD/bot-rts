#!/bin/sh
# Creates the lifecycle policy and the index templates of the Phase 13 indices. Idempotent: running it again replaces them.
set -eu

url="${ELASTICSEARCH_URL:?ELASTICSEARCH_URL is required}"
days="${LOG_RETENTION_DAYS:-14}"
dir="$(dirname "$0")"

put() {
  curl -fsS -X PUT "$url/$1" -H 'Content-Type: application/json' --data-binary "$2" >/dev/null
  echo "created $1"
}

put "_ilm/policy/botrts-retention" "$(sed "s/__RETENTION_DAYS__/${days}/" "$dir/ilm-policy.json")"
put "_index_template/botrts-logs" "$(cat "$dir/logs-template.json")"
put "_index_template/botrts-traces" "$(cat "$dir/traces-template.json")"
