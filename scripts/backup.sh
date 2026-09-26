#!/usr/bin/env bash
# SecureCloud backup script.
#
# What this backs up:
#   1. MariaDB (Nextcloud's database) — via mysqldump, application-consistent.
#   2. Nextcloud data directory (the actual files) — via the nextcloud_data volume.
#   3. Nextcloud config.php and .env — configuration and secrets.
#
# What this does NOT do:
#   - It does not back up to an offsite/remote location. Copy the resulting
#     archive elsewhere yourself (e.g. rsync to another disk or cloud storage).
#   - It does not encrypt the archive. It contains secrets (.env) — store it
#     somewhere access-controlled, or encrypt it yourself (e.g. gpg -c).
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
[ -f .env ] && set -a && . ./.env && set +a

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="backups/${TIMESTAMP}"
mkdir -p "$BACKUP_DIR"

echo "Putting Nextcloud into maintenance mode..."
docker exec -u www-data securecloud-nextcloud php occ maintenance:mode --on

cleanup() {
  echo "Taking Nextcloud out of maintenance mode..."
  docker exec -u www-data securecloud-nextcloud php occ maintenance:mode --off || true
}
trap cleanup EXIT

echo "Dumping MariaDB database..."
docker exec securecloud-mariadb sh -c \
  "exec mysqldump -u root -p'${NEXTCLOUD_DB_ROOT_PASSWORD}' ${NEXTCLOUD_DB_NAME}" \
  > "${BACKUP_DIR}/database.sql"

echo "Archiving Nextcloud data volume..."
docker run --rm \
  -v securecloud_nextcloud_data:/data:ro \
  -v "$(pwd)/${BACKUP_DIR}:/backup" \
  alpine tar czf /backup/nextcloud_data.tar.gz -C /data .

echo "Copying config.php..."
docker cp securecloud-nextcloud:/var/www/html/config/config.php "${BACKUP_DIR}/config.php"

echo "Copying environment file (contains secrets — handle securely)..."
cp .env "${BACKUP_DIR}/env.backup"

echo
echo "Backup complete: ${BACKUP_DIR}"
echo "Contents:"
ls -lh "${BACKUP_DIR}"
echo
echo "To restore, see docs/installation.md#restoring-from-backup"
