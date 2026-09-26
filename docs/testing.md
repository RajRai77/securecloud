# Testing

## Automated unit tests

```bash
cd bot
npm install
npm test
```

Covers:
- Command/filename parsing and path-traversal prevention (`tests/sanitize.test.ts`)
- WhatsApp webhook HMAC signature verification, including tampering and missing-signature
  cases (`tests/whatsapp.test.ts`)

Extend this suite with mocked-axios tests for `nextcloud.ts` integration logic and
`conversationController.ts` state transitions as the project matures — the structure
(`services/`, `integrations/`, `controllers/` split from `session/`) is designed so each layer
can be unit-tested independently by mocking the layer below it.

## Manual integration-test checklist

Run this after `./scripts/setup.sh` completes successfully. See
[`tests/integration/checklist.md`](../tests/integration/checklist.md) for the full checklist
with expected results for each step (upload via web UI and WhatsApp, list/select/download/
share/delete via WhatsApp, storage info, Docker restart persistence, backup and restore).
