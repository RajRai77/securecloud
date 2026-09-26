#!/usr/bin/env bash
# SecureCloud setup script — Linux Mint 22.x / Ubuntu 24.04
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }

echo "========================================"
echo " SecureCloud Setup"
echo "========================================"

# 1. OS check
if [ -f /etc/os-release ]; then
  . /etc/os-release
  ok "Detected OS: $PRETTY_NAME"
else
  warn "Could not detect OS via /etc/os-release, continuing anyway."
fi

# 2. Architecture check
ARCH="$(uname -m)"
if [ "$ARCH" = "x86_64" ]; then
  ok "Architecture: $ARCH"
else
  warn "Architecture $ARCH is untested; this project targets x86_64/amd64."
fi

# 3. Docker check
if command -v docker >/dev/null 2>&1; then
  ok "Docker found: $(docker --version)"
else
  fail "Docker is not installed."
  echo
  echo "Install Docker Engine manually, e.g.:"
  echo "  curl -fsSL https://get.docker.com | sh"
  echo "  sudo usermod -aG docker \$USER   # then log out/in"
  echo
  exit 1
fi

# 4. Docker Compose check
if docker compose version >/dev/null 2>&1; then
  ok "Docker Compose plugin found: $(docker compose version --short 2>/dev/null || echo present)"
else
  fail "Docker Compose plugin not found."
  echo "Install it with: sudo apt-get install docker-compose-plugin"
  exit 1
fi

# 5. Docker daemon reachable without sudo?
if ! docker info >/dev/null 2>&1; then
  fail "Cannot talk to the Docker daemon. Is your user in the 'docker' group?"
  echo "  sudo usermod -aG docker \$USER   # then log out and back in"
  exit 1
fi
ok "Docker daemon reachable"

# 6. Required directories
mkdir -p docker/reverse-proxy/data docker/reverse-proxy/config
ok "Runtime directories ready"

# 7. Validate environment configuration
if [ ! -f .env ]; then
  cp .env.example .env
  warn ".env created from .env.example — EDIT IT before continuing:"
  echo "    nano .env"
  echo
  echo "At minimum you must set:"
  echo "  NEXTCLOUD_DB_PASSWORD, NEXTCLOUD_DB_ROOT_PASSWORD, NEXTCLOUD_ADMIN_PASSWORD,"
  echo "  REDIS_PASSWORD, NEXTCLOUD_BOT_APP_PASSWORD,"
  echo "  WHATSAPP_ACCESS_TOKEN, WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET, WHATSAPP_PHONE_NUMBER_ID"
  echo
  read -rp "Press Enter once you have edited .env to continue, or Ctrl+C to stop now..." _
else
  ok ".env already present"
fi

# Basic sanity check for placeholder values
if grep -q "changeme" .env; then
  warn "Your .env still contains 'changeme' placeholder values. Update them before going to production."
fi

# 8. Pull required images
echo
echo "Pulling Docker images (this can take a while on first run)..."
docker compose pull mariadb redis nextcloud
ok "Base images pulled"

# 9. Start services
echo
echo "Building and starting services..."
docker compose up -d --build mariadb redis nextcloud securecloud-bot

# 10. Wait for health checks
echo
echo "Waiting for services to become healthy..."
ATTEMPTS=0
MAX_ATTEMPTS=40
until [ "$(docker inspect -f '{{.State.Health.Status}}' securecloud-nextcloud 2>/dev/null)" = "healthy" ]; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
    fail "Nextcloud did not become healthy in time. Check: docker compose logs nextcloud"
    exit 1
  fi
  sleep 5
done
ok "Nextcloud is healthy"

# 11. Display URLs
BOT_PORT="$(grep -E '^BOT_PORT=' .env | cut -d= -f2 || echo 3000)"
NC_PORT="$(grep -E '^NEXTCLOUD_PORT=' .env | cut -d= -f2 || echo 8080)"
echo
echo "========================================"
echo " SecureCloud is up!"
echo "========================================"
echo "Nextcloud web UI:   http://localhost:${NC_PORT:-8080}"
echo "Bot health check:   http://localhost:${BOT_PORT:-3000}/health"
echo
echo "Next steps:"
echo "  1. Log into Nextcloud at http://localhost:${NC_PORT:-8080} with your admin credentials."
echo "  2. Create a dedicated 'securecloud-bot' user and generate an app password"
echo "     (Settings > Security > Devices & Sessions), then put it in .env as"
echo "     NEXTCLOUD_BOT_APP_PASSWORD and restart: docker compose restart securecloud-bot"
echo "  3. Configure your Meta WhatsApp Cloud API app's webhook to point at:"
echo "     https://<your-public-domain>/webhook  (see docs/whatsapp-setup.md)"
echo
echo "Run ./scripts/health-check.sh any time to verify system status."
