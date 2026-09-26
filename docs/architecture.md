# Architecture

## Overview

SecureCloud is built on the principle of **reusing mature software wherever possible**.
Nextcloud is a production-grade, widely audited file-storage platform — SecureCloud does not
reimplement storage, sharing, or authentication. Instead, it adds a conversational WhatsApp
interface on top of Nextcloud's existing APIs.

## Components

| Component | Role | Technology |
|---|---|---|
| Nextcloud | File storage, web dashboard, sharing, auth | Official `nextcloud:29-apache` image |
| MariaDB | Nextcloud's relational database | Official `mariadb:11.4` image |
| Redis | Nextcloud caching/locking + bot session store | Official `redis:7-alpine` image |
| SecureCloud Bot | WhatsApp <-> Nextcloud bridge | Node.js 20, TypeScript, Express |
| Caddy (optional) | HTTPS reverse proxy, automatic certs | Official `caddy:2-alpine` image |

## Data flow: uploading a file

1. User sends a document to the WhatsApp number.
2. Meta's WhatsApp Cloud API POSTs a webhook event to `POST /webhook` on the bot.
3. The bot verifies the request's HMAC signature (`X-Hub-Signature-256`) using
   `WHATSAPP_APP_SECRET`.
4. The bot calls the Graph API to resolve the WhatsApp media ID to a short-lived download URL,
   then downloads the file into memory.
5. The bot uploads the file to the user's `SecureCloud/` folder in Nextcloud over WebDAV,
   authenticating as a dedicated Nextcloud app-password user.
6. The bot replies to the user confirming the upload.
7. The file is immediately visible in the Nextcloud web UI — no separate sync step.

## Data flow: sharing a file

1. User selects "Share" for a file resolved from their **session-side file list** (never from
   a user-typed filename).
2. The bot calls Nextcloud's OCS Share API (`POST /ocs/v2.php/apps/files_sharing/api/v1/shares`)
   requesting a public, read-only link with a generated password and an expiry date.
3. Nextcloud returns the real share URL, which the bot relays to the user verbatim — the bot
   never fabricates or guesses a link.

## Session state

Each WhatsApp user (`wa_id`) has an isolated session stored in Redis with a TTL
(`BOT_SESSION_TTL_SECONDS`). Sessions hold: the current conversation stage, the last file
listing shown to that user, and the currently selected file. Numeric replies ("2", "3") are
only ever resolved against that user's own stored file list — never interpreted as a raw
filename or path — which prevents cross-user state leakage and path-traversal attacks.

## Why not sync the whole Nextcloud data folder to WhatsApp?

WhatsApp messages are the trigger and transport, not the source of truth. Nextcloud remains
the single source of truth for files; the bot is a thin, stateless (aside from session hints)
bridge on top of it.
