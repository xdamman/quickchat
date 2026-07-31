#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Deploy QuickChat's Vite build to a local nginx static root.

Usage: scripts/deploy-local-nginx.sh [options]

Options:
  --target DIR       Deploy target (default: /var/www/quickchat or QUICKCHAT_DEPLOY_TARGET)
  --dry-run          Build and show what would change, but do not write to target
  --skip-tests       Skip npm test before building
  --include-config   Replace target config.json with the repo/build config.json
  -h, --help         Show this help

Default behavior preserves the live target's config.json because chat.xavierdamman.com
currently uses a production config that differs from the repo's public/config.json.
EOF
}

TARGET="${QUICKCHAT_DEPLOY_TARGET:-/var/www/quickchat}"
DRY_RUN=0
RUN_TESTS=1
INCLUDE_CONFIG=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="${2:-}"
      if [[ -z "$TARGET" ]]; then
        echo "--target requires a directory" >&2
        exit 2
      fi
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --skip-tests)
      RUN_TESTS=0
      shift
      ;;
    --include-config)
      INCLUDE_CONFIG=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "Deploying QuickChat"
echo "  repo:   $REPO_ROOT"
echo "  branch: $(git branch --show-current 2>/dev/null || echo unknown)"
echo "  commit: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "  target: $TARGET"

if [[ ! -d node_modules ]]; then
  echo "node_modules missing; running npm ci"
  npm ci
fi

if [[ "$RUN_TESTS" -eq 1 ]]; then
  npm test
fi

npm run build

test -f dist/index.html

RSYNC_ARGS=(
  -a
  --no-perms
  --no-owner
  --no-group
  --delete
  --itemize-changes
)

if [[ "$INCLUDE_CONFIG" -eq 0 ]]; then
  RSYNC_ARGS+=(--exclude=/config.json)

  # Preserve production-only helpers that may exist in the nginx root but are not
  # part of the Vite dist/. Without these excludes, --delete can silently remove
  # runtime shims that the preserved production config still depends on.
  RSYNC_ARGS+=(--exclude=/contact-source.js --exclude=/contact-source.test.mjs --exclude=/package.json)

  # chat.xavierdamman.com may use a production config with a contactSource shim
  # for NIP-05 caching. If the target has that shim, inject it into the freshly
  # built index.html before the app bundle so a normal deploy doesn't erase the
  # production-only behavior.
  if [[ -f "$TARGET/contact-source.js" && -f "$TARGET/config.json" ]]; then
    if node -e "const c=require(process.argv[1]); process.exit(c.contactSource ? 0 : 1)" "$TARGET/config.json"; then
      if ! grep -q '/contact-source.js' dist/index.html; then
        python3 - <<'PY'
from pathlib import Path
p = Path('dist/index.html')
s = p.read_text()
insert = '    <script>window.__QUICKCHAT_NIP05_FRESH_MS=3600000;window.__QUICKCHAT_NIP05_STALE_MS=604800000;</script>\n    <script type="module" src="/contact-source.js"></script>\n'
marker = '    <script type="module" crossorigin src="/assets/'
if marker not in s:
    raise SystemExit('app script marker not found in dist/index.html')
p.write_text(s.replace(marker, insert + marker, 1))
PY
      fi
    fi
  fi
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo
  echo "Dry run: no files will be changed."
  rsync "${RSYNC_ARGS[@]}" --dry-run dist/ "$TARGET/"
  exit 0
fi

SUDO=()
if [[ ! -w "$(dirname "$TARGET")" || ( -e "$TARGET" && ! -w "$TARGET" ) ]]; then
  SUDO=(sudo)
fi

if [[ ! -d "$TARGET" ]]; then
  "${SUDO[@]}" mkdir -p "$TARGET"
fi

BACKUP_DIR="/var/backups/quickchat"
if ! mkdir -p "$BACKUP_DIR" 2>/dev/null || [[ ! -w "$BACKUP_DIR" ]]; then
  BACKUP_DIR="$HOME/quickchat-backups"
  mkdir -p "$BACKUP_DIR"
fi
BACKUP_FILE="$BACKUP_DIR/quickchat-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
if [[ -d "$TARGET" ]]; then
  echo "Creating backup: $BACKUP_FILE"
  if [[ -w "$BACKUP_DIR" ]]; then
    tar -C "$TARGET" -czf "$BACKUP_FILE" .
  else
    "${SUDO[@]}" tar -C "$TARGET" -czf "$BACKUP_FILE" .
  fi
fi

echo "Syncing dist/ to $TARGET/"
"${SUDO[@]}" rsync "${RSYNC_ARGS[@]}" --omit-dir-times dist/ "$TARGET/"

# Keep nginx workers able to read the static tree even when deployed by root.
if [[ ${#SUDO[@]} -gt 0 ]]; then
  "${SUDO[@]}" find "$TARGET" -type d -exec chmod 755 {} +
  "${SUDO[@]}" find "$TARGET" -type f -exec chmod 644 {} +
else
  find "$TARGET" -user "$(id -u)" -type d -exec chmod 755 {} +
  find "$TARGET" -user "$(id -u)" -type f -exec chmod 644 {} +
fi

if [[ "$INCLUDE_CONFIG" -eq 0 && ! -f "$TARGET/config.json" && -f dist/config.json ]]; then
  echo "No target config.json existed; installing dist/config.json once."
  "${SUDO[@]}" install -m 0644 dist/config.json "$TARGET/config.json"
fi

echo "Deployment complete."
echo "Backup: $BACKUP_FILE"

if command -v curl >/dev/null 2>&1; then
  echo
  echo "Live headers:"
  curl -I --max-time 10 https://chat.xavierdamman.com/ | sed -n '1,12p' || true
fi
