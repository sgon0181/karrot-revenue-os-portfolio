#!/usr/bin/env bash
set -euo pipefail

database_container="supabase_db_karrot-revenue-os"
migration="supabase/migrations/20260826180000_sample_account_boundary.sql"
setup="tests/integration/database/sample_account_migration_replay_setup.sql"
assertions="tests/integration/database/sample_account_migration_replay_assert.sql"

before_counts="$(docker exec -i "$database_container" psql \
  -U postgres -d postgres -Atc \
  "select count(*) from public.providers where not is_sample; select count(*) from public.facilities where not is_sample;")"

docker exec -i "$database_container" psql \
  -U postgres -d postgres -v ON_ERROR_STOP=1 < "$setup"

docker exec -i "$database_container" psql \
  -U postgres -d postgres -v ON_ERROR_STOP=1 < "$migration"

docker exec -i "$database_container" psql \
  -U postgres -d postgres -v ON_ERROR_STOP=1 < "$assertions"

after_counts="$(docker exec -i "$database_container" psql \
  -U postgres -d postgres -Atc \
  "select count(*) from public.providers where not is_sample; select count(*) from public.facilities where not is_sample;")"

if [[ "$before_counts" != "$after_counts" ]]; then
  echo "Authoritative provider/facility counts changed during sample migration replay." >&2
  diff -u <(printf '%s\n' "$before_counts") <(printf '%s\n' "$after_counts") >&2 || true
  exit 1
fi

printf '%s\n' 'Sample-account migration replay preserved authoritative counts and unrelated data.'
