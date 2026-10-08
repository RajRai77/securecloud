#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== SecureCloud Status ==="
echo ""
echo "Docker Containers:"
docker compose ps

echo ""
echo "Docker Service Logs (last 5 lines per service):"
docker compose logs --tail=5

echo ""
echo "System Storage:"
df -h | grep -E "Filesystem|/dev/sda1|/dev/root|/var/lib/docker"

echo ""
echo "Memory Usage:"
free -h

echo ""
echo "=== End of Status ==="
