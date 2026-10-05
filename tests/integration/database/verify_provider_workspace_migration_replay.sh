#!/usr/bin/env bash
set -euo pipefail

database_container="supabase_db_karrot-revenue-os"
before_history="$(mktemp)"
after_history="$(mktemp)"

cleanup() {
  rm -f "$before_history" "$after_history"
}
trap cleanup EXIT

docker exec -i "$database_container" psql \
  -U postgres \
  -d postgres \
  -v ON_ERROR_STOP=1 \
  < tests/integration/database/provider_workspace_migration_replay_setup.sql

npx --no-install supabase migration list --local > "$before_history"

replay_output="$(npx --no-install supabase migration up --local 2>&1)"
printf '%s\n' "$replay_output"

if grep -qi 'up to date' <<< "$replay_output"; then
  printf '%s\n' 'Tracked migration application reports the database is up to date.'
elif grep -Eq '"applied"[[:space:]]*:[[:space:]]*\[\]' <<< "$replay_output"; then
  printf '%s\n' 'Tracked migration application is up to date (zero migrations applied).'
else
  echo 'Expected the second tracked migration application to report up to date or zero applied migrations.' >&2
  exit 1
fi

npx --no-install supabase migration list --local > "$after_history"
diff -u "$before_history" "$after_history"

docker exec -i "$database_container" psql \
  -U postgres \
  -d postgres \
  -v ON_ERROR_STOP=1 \
  < tests/integration/database/provider_workspace_migration_replay_assert.sql
