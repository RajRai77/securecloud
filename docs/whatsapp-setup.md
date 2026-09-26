# WhatsApp Cloud API Setup

SecureCloud uses Meta's **official WhatsApp Cloud API** — not an unofficial automation
library — so it needs a Meta developer account and app.

## 1. Create a Meta developer account and app

1. Go to https://developers.facebook.com/ and create/log in to a developer account.
2. Create a new app → type **Business**.
3. Add the **WhatsApp** product to the app.
4. Meta provisions a free test phone number automatically for development.

## 2. Collect your credentials

From the WhatsApp → API Setup page in the Meta developer console, note:

- **Temporary access token** (or generate a permanent one via a System User for production)
  → `WHATSAPP_ACCESS_TOKEN`
- **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`
- **App secret** (App settings → Basic) → `WHATSAPP_APP_SECRET`

Choose your own random string for `WHATSAPP_VERIFY_TOKEN` — this is a value **you** invent and
enter in both `.env` and the Meta console webhook config; it is not provided by Meta.

## 3. Expose your webhook

Meta requires an HTTPS URL it can reach.

**Local development:** use a tunnel, e.g.
```bash
ngrok http 3000
```
Take the `https://xxxx.ngrok-free.app` URL it prints.

**Public deployment:** use your real domain behind the bundled Caddy reverse proxy (see
[installation.md](installation.md#6-optional-enable-https-reverse-proxy)), or a tunnel such as
Cloudflare Tunnel / Tailscale Funnel if you prefer not to open inbound ports (see
[architecture.md](architecture.md) and the "Remote home server" notes in the README).

## 4. Configure the webhook in the Meta console

1. WhatsApp → Configuration → Webhook → **Edit**.
2. Callback URL: `https://<your-url>/webhook`
3. Verify token: the same string you put in `WHATSAPP_VERIFY_TOKEN`.
4. Click **Verify and Save** — the bot's `GET /webhook` handler
   (`src/controllers/webhookController.ts::verifyWebhook`) must respond correctly or this
   step fails; check `docker compose logs securecloud-bot` if it does.
5. Subscribe to the **messages** field.

## 5. Add a test recipient (development mode)

Meta's test numbers can only message phone numbers you've explicitly added as testers:
WhatsApp → API Setup → "To" field → **Manage phone number list** → add your own number and
verify it via the SMS/call code Meta sends.

## 6. Send "Hi" to the test number

You should receive the SecureCloud welcome menu. If not, see
[troubleshooting.md](troubleshooting.md#webhook-failures).

## Going to production

- Submit the app for **App Review** (permission: `whatsapp_business_messaging`) to message
  any number, not just verified testers.
- Register a real WhatsApp Business phone number instead of the free test number.
- Switch to a permanent access token generated for a System User with the WhatsApp
  permission, rather than the short-lived token from the API Setup page.
