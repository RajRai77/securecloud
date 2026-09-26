#!/usr/bin/env bash
# DANGER: destroys all SecureCloud data (Nextcloud files, database, redis).
# Intended for local development only — never run this against real data.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

read -rp "This will DELETE all SecureCloud data. Type 'DELETE' to confirm: " CONFIRM
if [ "$CONFIRM" != "DELETE" ]; then
  echo "Aborted."
  exit 1
fi

docker compose --profile proxy down -v
echo "All SecureCloud containers and volumes removed."
echo "Run ./scripts/setup.sh to start fresh."
