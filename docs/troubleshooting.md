# Troubleshooting

## Docker not installed
```
docker: command not found
```
Install Docker Engine: `curl -fsSL https://get.docker.com | sh`, then
`sudo usermod -aG docker $USER` and log out/in.

## Docker permission errors
```
permission denied while trying to connect to the Docker daemon socket
```
Your user isn't in the `docker` group yet, or the session hasn't picked up the change:
```bash
sudo usermod -aG docker $USER
newgrp docker   # or log out and back in
```

## Port conflicts
```
Error starting userland proxy: listen tcp4 0.0.0.0:80: bind: address already in use
```
Something else (Apache, another container) is already using that port. Either stop it, or
change the conflicting mapping in `docker-compose.yml` (e.g. bot's `BOT_PORT` in `.env`, or
Caddy's `80:80`/`443:443`).

## Nextcloud database connection failures
```
"Cannot connect to database" / nextcloud logs show mariadb errors
```
1. Check MariaDB is healthy: `docker compose ps mariadb`
2. Check logs: `docker compose logs mariadb`
3. Confirm `NEXTCLOUD_DB_*` values in `.env` match what MariaDB was initialized with — if you
   change a DB password after first run, MariaDB won't pick it up automatically (its data
   volume already has the old credentials baked in); you'd need to change it inside MariaDB
   directly or reset the volume (`scripts/reset-dev.sh`, dev only).

## Redis connection failures
```
NOAUTH Authentication required / bot logs show Redis connection error
```
Confirm `REDIS_PASSWORD` in `.env` matches what's passed to the `redis` service and to the
bot's `REDIS_URL`. Restart both: `docker compose restart redis securecloud-bot`.

## Webhook failures

- **Verification fails (Meta console shows an error saving the webhook):** confirm
  `WHATSAPP_VERIFY_TOKEN` matches exactly between `.env` and the Meta console, and that your
  tunnel/domain is actually reachable (`curl https://<url>/webhook?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=123`
  should return `123`).
- **Verified, but messages don't arrive:** confirm you subscribed to the `messages` webhook
  field, and that your WhatsApp number is on the tester allow-list in development mode.
- **403 on POST /webhook:** signature mismatch — confirm `WHATSAPP_APP_SECRET` is the app's
  secret (App settings → Basic), not the access token.

## WhatsApp authentication failures
```
Error validating access token
```
Access tokens from the API Setup page are short-lived test tokens; regenerate one, or switch
to a permanent System User token for anything beyond a quick demo.

## HTTPS problems
If using the bundled Caddy profile and certificates aren't issuing: confirm `NEXTCLOUD_DOMAIN`
is a real, publicly resolvable domain pointing at this machine's public IP, and that ports
80/443 are open on your router/firewall (Let's Encrypt's HTTP-01 challenge needs port 80).

## File upload problems
- **"File is too large"**: check `BOT_MAX_UPLOAD_MB` in `.env` and Nextcloud's own
  `upload_max_filesize`/`post_max_size` in `docker/nextcloud/custom-php.ini`.
- **Upload succeeds in bot logs but file isn't in Nextcloud**: confirm
  `NEXTCLOUD_BOT_APP_PASSWORD` is a valid, non-expired app password for the
  `NEXTCLOUD_BOT_USERNAME` account.
