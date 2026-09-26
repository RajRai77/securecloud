#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PROFILE_ARGS=()
if [ "${1:-}" = "--with-proxy" ]; then
  PROFILE_ARGS=(--profile proxy)
fi

docker compose "${PROFILE_ARGS[@]}" up -d
echo "SecureCloud started. Run ./scripts/health-check.sh to verify."
