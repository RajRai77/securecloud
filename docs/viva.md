# Viva Questions & Answers

**Q: Why did you build on top of Nextcloud instead of writing your own file storage backend?**
A: Reimplementing authenticated, ACID-safe file storage, sharing, and a web UI is a huge
undertaking with serious security implications if done incorrectly. Nextcloud is a mature,
widely deployed, actively maintained open-source platform. Building on it lets the project
focus its original engineering effort on the genuinely novel part — the WhatsApp
conversational interface and its secure integration with Nextcloud's APIs — which is a better
use of capstone time and produces a more trustworthy result.

**Q: How does the bot authenticate to Nextcloud, and why not use the admin account?**
A: The bot authenticates as a dedicated `securecloud-bot` Nextcloud user via an **app
password**, generated from Nextcloud's Security settings. App passwords can be scoped and
revoked independently of the account's real password, so a leaked bot credential doesn't
compromise the admin account, and rotating it doesn't require the admin to change their own
login.

**Q: How do you prevent one WhatsApp user's actions from affecting another user's files or
session?**
A: Every session is stored in Redis under a key namespaced by the sender's WhatsApp user ID
(`securecloud:session:<wa_id>`). All reads and writes go through that same namespaced key, so
there is no shared/global mutable state a concurrent request could corrupt.

**Q: How do you prevent path traversal or arbitrary file access from a malicious WhatsApp
message?**
A: File selection never accepts a user-typed filename or path. The bot lists files from
Nextcloud, stores that list server-side in the user's session, and only accepts a numeric
index into that list. All filenames/paths are additionally passed through sanitizers
(`sanitizeFilename`, `sanitizeWebdavPath`) that strip `..` segments and directory components
before ever being used in a WebDAV call.

**Q: How do you know a webhook request actually came from WhatsApp/Meta and not an attacker?**
A: Every `POST /webhook` request must carry a valid `X-Hub-Signature-256` header — an
HMAC-SHA256 of the raw request body keyed with the app secret. The bot recomputes it and
compares with a constant-time comparison (`crypto.timingSafeEqual`) to avoid timing attacks;
requests that don't match are rejected with 403 before any business logic runs.

**Q: What happens if a file is too large to send back over WhatsApp?**
A: WhatsApp's Cloud API has a practical document size ceiling. The bot checks the file's known
size before attempting to send it; if it's over the safe threshold, it doesn't crash or
silently fail — it tells the user and offers a secure Nextcloud share link instead, which has
no such size limit.

**Q: Why Redis for sessions instead of just an in-memory JavaScript object?**
A: An in-memory object is lost on every restart/crash and doesn't survive if the bot is ever
scaled to multiple replicas. Redis persists session state, gives every session a TTL (auto
expiring stale conversations), and keeps the bot process itself stateless.

**Q: How do you protect secrets like the WhatsApp access token or database passwords?**
A: All secrets are supplied via environment variables read from a `.env` file that is
git-ignored (`.env.example` only contains placeholders). The application logger explicitly
redacts token/password/secret fields so they can never end up in log output, and secrets are
never printed to the WhatsApp conversation.

**Q: What's your disaster-recovery story?**
A: `scripts/backup.sh` dumps the MariaDB database, archives the Nextcloud data volume, and
copies `config.php` and `.env` into a timestamped backup directory, wrapping the Nextcloud
data operations in maintenance mode for consistency. `docs/installation.md` documents the
exact restore procedure. Since all state lives in named Docker volumes, a `docker compose
down` (without `-v`) and `docker compose up -d` cycle preserves all data by design — verified
explicitly in the demo (Demo 9/10).

**Q: How would you scale this beyond one user?**
A: The architecture already isolates sessions per WhatsApp user, so the main remaining work is
mapping each WhatsApp number to its own Nextcloud account (rather than one shared bot account)
and adding a lightweight registration/onboarding flow — deliberately left out of the MVP per
the "keep it simple, no unnecessary multi-tenant SaaS" scope decision.

**Q: What did you deliberately choose *not* to build, and why?**
A: A custom frontend, a custom file storage/sync engine, Kubernetes, and multi-tenant SaaS
features (billing, subscriptions). Nextcloud already solves storage and the web UI; adding a
parallel custom implementation would duplicate a mature, security-audited system with a less
mature one, for no functional benefit to the stated use case.
