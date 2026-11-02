# Sourced by the pre-push hook of the framework (hooks.prePushSetup of harness-profile.json) before the gate runs: the local settings of this checkout.
# A checkout with a database port of its own (POSTGRES_PORT in .env, docs/testing/README.md) tests against that database.
if [ -f .env ]; then set -a; . ./.env; set +a; fi
export DATABASE_URL="${DATABASE_URL:-postgresql://botrts:botrts@localhost:${POSTGRES_PORT:-5432}/botrts}"
export REDIS_URL="${REDIS_URL:-redis://localhost:${REDIS_PORT:-6379}}"
