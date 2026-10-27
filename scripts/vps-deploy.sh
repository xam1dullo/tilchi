#!/bin/sh
# Deploy one image tag on the VPS. Rollback = run again with the previous SHA.
# Runs from the repo checkout on the VPS (default /opt/tilchi). Reads secrets
# only from /etc/tilchi.env. Not called by CI until the deploy job is unheld.
set -eu

SHA="${1:?usage: scripts/vps-deploy.sh <40-char git sha>}"
case "$SHA" in
  *[!0-9a-f]*) echo "deploy: sha must be lowercase hex" >&2; exit 2 ;;
esac
[ "${#SHA}" -eq 40 ] || { echo "deploy: sha must be 40 chars" >&2; exit 2; }

ENV_FILE="${TILCHI_ENV_FILE:-/etc/tilchi.env}"
[ -r "$ENV_FILE" ] || { echo "deploy: cannot read $ENV_FILE" >&2; exit 2; }

git fetch --quiet origin "$SHA"
git checkout --quiet --detach "$SHA"

compose() {
  TILCHI_SHA="$SHA" docker compose \
    -f docker-compose.yml -f docker-compose.prod.yml \
    --env-file "$ENV_FILE" "$@"
}

compose config --quiet
compose pull start nest
compose up -d --wait postgres redis
# Migrations are forward-only. A rollback across a migration needs a manual plan.
compose run --rm --no-deps nest node dist/db/migrate.js
compose up -d --no-build --remove-orphans --wait

[ -f .deployed-sha ] && cp .deployed-sha .previous-sha
echo "$SHA" > .deployed-sha
echo "deploy: $SHA is live (previous: $(cat .previous-sha 2>/dev/null || echo none))"
