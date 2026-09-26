# Security

This project is a Virtualization and Cloud Security capstone; security is treated as a first-
class requirement, not an afterthought.

## Server

- Only expose ports you actually need: 80/443 (reverse proxy) if going public, or nothing
  beyond localhost for pure local development.
- Use `ufw` (Uncomplicated Firewall) to restrict inbound traffic:
  ```bash
  sudo ufw allow 22/tcp    # SSH — restrict to known IPs if possible
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw enable
  ```
- Disable SSH password authentication in favor of key-based auth; disable root SSH login.
- Keep the host OS patched (`sudo apt update && sudo apt upgrade`).

## Secrets management

- All credentials live in `.env`, which is excluded from git via `.gitignore`.
- `.env.example` contains only placeholders — never real secrets.
- The bot's logger (`bot/src/utils/logger.ts`) redacts tokens, passwords, and authorization
  headers from all log output.

## Docker

- Each service runs in its own container on a dedicated bridge network
  (`securecloud-net`), isolated from the host network.
- All state lives in named, persistent Docker volumes.
- Every service has a `restart: unless-stopped` policy and a `HEALTHCHECK`.
- The bot's Docker image runs as a **non-root user** (`securecloud`), created explicitly in
  the Dockerfile.
- Only the bot and (optionally) Caddy publish ports to the host; MariaDB and Redis are
  reachable only from other containers on `securecloud-net`.

## Nextcloud

- HTTPS-ready: the bundled Caddy reverse-proxy profile automatically provisions Let's Encrypt
  certificates when given a real public domain (`NEXTCLOUD_DOMAIN`).
- Share links are created with a password (`NEXTCLOUD_SHARE_PASSWORD_DEFAULT_ENABLED`) and an
  expiry date (`NEXTCLOUD_SHARE_EXPIRY_DAYS`) by default.
- The bot authenticates to Nextcloud with a dedicated user and an **app password**, never the
  admin account or the admin's real password. App passwords can be revoked independently from
  Nextcloud's UI without affecting the admin login.

## Bot-level security controls

| Control | Where implemented |
|---|---|
| Webhook signature verification (`X-Hub-Signature-256`, HMAC-SHA256, constant-time compare) | `src/integrations/whatsapp.ts::verifyWebhookSignature`, enforced by `src/middleware/security.ts::verifySignature` |
| Webhook payload validation | `src/controllers/webhookController.ts` — malformed/unexpected payloads are ignored, not trusted |
| Command/selection validation | `src/utils/sanitize.ts::parseSelection` — only exact numeric strings within the known list length are accepted |
| Path-traversal prevention | `src/utils/sanitize.ts::sanitizeFilename` / `sanitizeWebdavPath` — filenames and paths are always cleaned before touching Nextcloud, and file selection is resolved against server-side session state, never user-typed paths |
| No filesystem paths ever exposed to users | Menu templates (`src/services/menu.ts`) show only filenames, never WebDAV/server paths |
| No shell execution from user input | The bot never calls `exec`/`spawn` with any user-derived string |
| Secrets via environment variables only | `src/config/index.ts` reads all secrets from `process.env`; nothing is hard-coded |
| Rate limiting | `src/middleware/security.ts::rateLimit` — fixed-window limiter per source IP |
| Session isolation | `src/session/sessionStore.ts` — every session key is namespaced by the WhatsApp user id, so no cross-user data leakage is possible even under concurrent use |
| Safe logging | `src/utils/logger.ts` — redacts tokens/passwords/secrets from all log lines |

## Access control

The bot supports a **WhatsApp number allowlist** via `ALLOWED_WHATSAPP_NUMBERS` in `.env`.
Set it to a comma-separated list of WhatsApp user IDs (phone numbers in E.164 format without
the `+`, e.g. `919876543210`) to restrict the bot to specific users. If the env var is empty,
any WhatsApp number that can reach the webhook can use the bot — this is acceptable for
private/local testing, but set an allowlist before any public exposure.

## Known limitations (documented, not hidden)

- The MVP is single-tenant: the bot manages one Nextcloud account's files, accessed from any
  WhatsApp number on the allowlist. To fully isolate files per WhatsApp user, each would need
  their own Nextcloud account — deliberately left out of scope per the single-user design goal.
- Rate limiting is in-memory and per-process; it resets on restart and does not scale across
  multiple bot replicas. Acceptable for a single-instance capstone deployment.
