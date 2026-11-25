#!/usr/bin/env bash
set -Eeuo pipefail

# Weekly encrypted-at-rest PostgreSQL backup with four-copy rotation.
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_GPG_RECIPIENT:?BACKUP_GPG_RECIPIENT is required (GPG public-key fingerprint or email)}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/carbon-ledger}"
KEEP_COUNT="${KEEP_COUNT:-4}"
GPG_PUBLIC_KEY_FILE="${GPG_PUBLIC_KEY_FILE:-}"
mkdir -p "$BACKUP_DIR"
umask 077

# Prisma appends Postgres-only query options that pg_dump rejects.
PG_URL="${DATABASE_URL%%\?*}"

if [[ -n "$GPG_PUBLIC_KEY_FILE" ]]; then
  if [[ ! -r "$GPG_PUBLIC_KEY_FILE" ]]; then
    echo "BACKUP_GPG_PUBLIC_KEY_FILE is not readable: $GPG_PUBLIC_KEY_FILE" >&2
    exit 1
  fi
  gpg --batch --import "$GPG_PUBLIC_KEY_FILE" >/dev/null 2>&1
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$BACKUP_DIR/carbonledger-$stamp.dump.gz.gpg"
tmp="$out.partial"
trap 'rm -f -- "$tmp"' EXIT
pg_dump "$PG_URL" --format=custom | gzip --no-name | gpg --batch --yes --trust-model always --recipient "$BACKUP_GPG_RECIPIENT" --encrypt > "$tmp"

if [[ ! -s "$tmp" ]]; then
  echo "Backup produced no data; aborting." >&2
  exit 1
fi
mv -- "$tmp" "$out"

# Keep the newest four successful encrypted dumps; filenames are timestamp ordered.
mapfile -t old < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'carbonledger-*.dump.gz.gpg' -printf '%T@ %p\n' | sort -nr | tail -n +$((KEEP_COUNT + 1)) | cut -d' ' -f2-)
for file in "${old[@]}"; do
  rm -f -- "$file"
done

printf 'backup=%s retained=%s\n' "$out" "$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'carbonledger-*.dump.gz.gpg' | wc -l)"
