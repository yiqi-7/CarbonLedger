#!/usr/bin/env bash
set -Eeuo pipefail

# Weekly encrypted-at-rest PostgreSQL backup with four-copy rotation.
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_GPG_RECIPIENT:?BACKUP_GPG_RECIPIENT is required (GPG public-key fingerprint or email)}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/carbon-ledger}"
KEEP_COUNT="${KEEP_COUNT:-4}"
mkdir -p "$BACKUP_DIR"
umask 077

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$BACKUP_DIR/carbonledger-$stamp.dump.gz.gpg"
tmp="$out.partial"
trap 'rm -f -- "$tmp"' EXIT
pg_dump "$DATABASE_URL" --format=custom | gzip --no-name | gpg --batch --yes --trust-model always --recipient "$BACKUP_GPG_RECIPIENT" --encrypt > "$tmp"
mv -- "$tmp" "$out"

# Keep the newest four successful encrypted dumps; filenames are timestamp ordered.
mapfile -t old < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'carbonledger-*.dump.gz.gpg' -printf '%T@ %p\n' | sort -nr | tail -n +$((KEEP_COUNT + 1)) | cut -d' ' -f2-)
for file in "${old[@]}"; do
  rm -f -- "$file"
done

printf 'backup=%s retained=%s\n' "$out" "$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'carbonledger-*.dump.gz.gpg' | wc -l)"
