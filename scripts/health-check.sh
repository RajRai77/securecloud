#!/usr/bin/env bash
# SecureCloud health check — verifies each service is actually functional,
# not just "container running".
set -uo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
[ -f .env ] && set -a && . ./.env && set +a

GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
OVERALL_OK=1

check() {
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} $name"
  else
    echo -e "${RED}✗${NC} $name"
    OVERALL_OK=0
  fi
}

echo "SecureCloud Health Check"
echo "========================="

check "Docker daemon" docker info
check "MariaDB" docker exec securecloud-mariadb healthcheck.sh --connect --innodb_initialized
check "Redis" docker exec securecloud-redis redis-cli -a "${REDIS_PASSWORD:-}" ping
check "Nextcloud" curl -fsS "http://localhost:${NEXTCLOUD_PORT:-8080}/status.php"
check "WhatsApp Bot" curl -fsS "http://localhost:${BOT_PORT:-3000}/health"

echo "========================="
if [ "$OVERALL_OK" -eq 1 ]; then
  echo -e "${GREEN}System Status: HEALTHY${NC}"
  exit 0
else
  echo -e "${RED}System Status: DEGRADED — see failing checks above${NC}"
  exit 1
fi
