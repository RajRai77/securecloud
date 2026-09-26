# Installation

## Prerequisites

- Linux Mint 22.x or Ubuntu 24.04 (x86_64)
- Docker Engine + Docker Compose plugin
- A Meta developer account with a WhatsApp Cloud API app (see
  [whatsapp-setup.md](whatsapp-setup.md)) — required only for the WhatsApp features; Nextcloud
  itself works without it.

## 1. Install Docker (if not already installed)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# log out and back in for the group change to take effect
newgrp docker   # or log out/in — needed once
```

## 2. Clone and configure

```bash
git clone <repository-url>
cd securecloud
cp .env.example .env
nano .env
```

Fill in at minimum:

- `NEXTCLOUD_DB_PASSWORD`, `NEXTCLOUD_DB_ROOT_PASSWORD`
- `NEXTCLOUD_ADMIN_USER`, `NEXTCLOUD_ADMIN_PASSWORD`
- `REDIS_PASSWORD`
- `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`,
  `WHATSAPP_PHONE_NUMBER_ID`

Leave `NEXTCLOUD_BOT_APP_PASSWORD` empty for now — it is filled in during step 4 after
Nextcloud is running.

**Important:** `NEXTCLOUD_DOMAIN` must include the port for local dev:

```
NEXTCLOUD_DOMAIN=localhost:8080
NEXTCLOUD_PORT=8080
```

## 3. Run setup

```bash
chmod +x scripts/*.sh
./scripts/setup.sh
```

This checks your OS/Docker installation, pulls images, starts MariaDB, Redis, Nextcloud, and
the bot, and waits for Nextcloud's health check to pass.

Nextcloud will be available at **http://localhost:8080**.

## 4. Create the bot's Nextcloud account

1. Open `http://localhost:8080` and log in as the admin user you set in `.env`.
2. Go to the top-right user menu → **Users** → **New user**.
3. Create a user named `securecloud-bot` (must match `NEXTCLOUD_BOT_USERNAME` in `.env`).
   Give it a password you won't need to remember (the bot uses an app password, not this).
4. Log out, log in as `securecloud-bot`.
5. Go to **Settings → Security → Devices & Sessions** → **Create new app password**.
   Name it `securecloud-bot-apppass` (or anything descriptive).
6. Copy the generated app password — it's only shown once.
7. Put it into `.env` as `NEXTCLOUD_BOT_APP_PASSWORD`.
8. Restart the bot so it picks up the new credential:
   ```bash
   docker compose restart securecloud-bot
   ```
9. Verify the bot is healthy:
   ```bash
   ./scripts/health-check.sh
   ```

## 5. Configure the WhatsApp webhook

See [whatsapp-setup.md](whatsapp-setup.md). For local development, expose port 3000 with a
tunnel such as `ngrok http 3000` and point Meta's webhook at the resulting HTTPS URL + `/webhook`.

For the simplest secure public exposure, use Cloudflare Tunnel (no router port-forwarding
required):

```bash
cloudflared tunnel --url http://localhost:3000
```

## 6. (Optional) Enable HTTPS reverse proxy

```bash
./scripts/start.sh --with-proxy
```

Set `NEXTCLOUD_DOMAIN` in `.env` to your real public domain first — Caddy will automatically
obtain a Let's Encrypt certificate for it. For purely local use, leave it as `localhost:8080`
and skip the proxy profile.

When using Caddy, also set:
```
NEXTCLOUD_PORT=80
NEXTCLOUD_OVERWRITE_PROTOCOL=https
NEXTCLOUD_OVERWRITE_CLI_URL=https://your.domain.com
TRUSTED_PROXIES=caddy
```

## Restoring from backup

Given a backup directory created by `scripts/backup.sh`:

```bash
docker compose stop nextcloud securecloud-bot
# restore the database
docker exec -i securecloud-mariadb sh -c \
  "mysql -u root -p'$NEXTCLOUD_DB_ROOT_PASSWORD' $NEXTCLOUD_DB_NAME" < backups/<timestamp>/database.sql
# restore the data volume
docker run --rm -v securecloud_nextcloud_data:/data \
  -v "$(pwd)/backups/<timestamp>:/backup" alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/nextcloud_data.tar.gz -C /data"
docker cp backups/<timestamp>/config.php securecloud-nextcloud:/var/www/html/config/config.php
docker compose start nextcloud securecloud-bot
```
