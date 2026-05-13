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
  --delete
  --itemize-changes
)

if [[ "$INCLUDE_CONFIG" -eq 0 ]]; then
  RSYNC_ARGS+=(--exclude=/config.json)
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo
  echo "Dry run: no files will be changed."
  rsync "${RSYNC_ARGS[@]}" --dry-run dist/ "$TARGET/"
  exit 0
fi

if [[ ! -d "$TARGET" ]]; then
  sudo mkdir -p "$TARGET"
fi

BACKUP_DIR="/var/backups/quickchat"
BACKUP_FILE="$BACKUP_DIR/quickchat-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
sudo mkdir -p "$BACKUP_DIR"
if [[ -d "$TARGET" ]]; then
  echo "Creating backup: $BACKUP_FILE"
  sudo tar -C "$TARGET" -czf "$BACKUP_FILE" .
fi

echo "Syncing dist/ to $TARGET/"
sudo rsync "${RSYNC_ARGS[@]}" dist/ "$TARGET/"

# Keep nginx workers able to read the static tree even when deployed by root.
sudo find "$TARGET" -type d -exec chmod 755 {} +
sudo find "$TARGET" -type f -exec chmod 644 {} +

if [[ "$INCLUDE_CONFIG" -eq 0 && ! -f "$TARGET/config.json" && -f dist/config.json ]]; then
  echo "No target config.json existed; installing dist/config.json once."
  sudo install -m 0644 dist/config.json "$TARGET/config.json"
fi

echo "Deployment complete."
echo "Backup: $BACKUP_FILE"

if command -v curl >/dev/null 2>&1; then
  echo
  echo "Live headers:"
  curl -I --max-time 10 https://chat.xavierdamman.com/ | sed -n '1,12p' || true
fi
