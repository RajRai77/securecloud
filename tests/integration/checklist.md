# Integration Test Checklist

Run through this after `./scripts/setup.sh` completes. Each step lists the action and the
expected real (non-mocked) result.

| # | Step | Expected result |
|---|---|---|
| 1 | Upload a file via the Nextcloud web UI (`http://localhost`) | File appears in the user's Nextcloud "Files" list |
| 2 | Send that same account's bot a document over WhatsApp | Bot replies "✅ Upload successful", file appears in `SecureCloud/` in Nextcloud web UI |
| 3 | Send `My Files` (or `2`) | Bot returns a real numbered list matching what's in Nextcloud |
| 4 | Reply with a valid number | Bot shows the file-action menu (Download/Share/Delete/Back) for that exact file |
| 5 | Reply `1` (Download) | Bot sends the real file back as a WhatsApp document; contents match the original |
| 6 | Select a file again, reply `2` (Share) | Bot returns a real, working Nextcloud share URL (opens the file when visited) with password + expiry as configured |
| 7 | Select a file, reply `3` (Delete), confirm `YES` | File is removed from Nextcloud web UI; bot confirms deletion |
| 8 | Send `Storage` (or `6`) | Bot reports real used/available/total figures matching Nextcloud's quota page (Settings → user) |
| 9 | `docker compose restart` (or full `down`/`up -d`, without `-v`) | All containers come back healthy |
| 10 | Re-check Nextcloud web UI and `My Files` via WhatsApp after restart | All previously uploaded files are still present — confirms persistent volumes are working |
| 11 | Run `./scripts/backup.sh` | Produces a timestamped backup directory containing `database.sql`, `nextcloud_data.tar.gz`, `config.php`, `env.backup` |
| 12 | Follow the restore procedure in `docs/installation.md` against a scratch/test environment | Restored instance shows the same files and users as the backup source |

## Automated checks

Run `./scripts/health-check.sh` before/after this checklist to confirm every service reports
healthy, and `cd bot && npm test` to run the unit-test suite (signature verification, path
sanitization).
