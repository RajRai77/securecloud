#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

docker compose --profile proxy stop
echo "SecureCloud stopped. Data volumes are preserved."
echo "Use 'docker compose down -v' only if you intend to permanently delete all data."
