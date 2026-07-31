#!/usr/bin/env bash
set -euo pipefail

# Deploy Paddock to a VPS via rsync and systemd.
# Usage: ./deploy.sh [user@host] [remote-path]

HOST="${1:-paddock}"
REMOTE_DIR="${2:-/opt/paddock}"

echo "→ Building project…"
npm ci --omit=dev

echo "→ Syncing to ${HOST}:${REMOTE_DIR}…"
rsync -avz --delete \
  --exclude node_modules \
  --exclude '*.db' \
  --exclude '.git' \
  --exclude test \
  ./ "${HOST}:${REMOTE_DIR}/"

echo "→ Installing deps and restarting on remote…"
ssh "${HOST}" <<EOF
  set -euo pipefail
  cd "${REMOTE_DIR}"
  npm ci --omit=dev
  sudo systemctl restart paddock || echo "Warning: systemctl restart failed (service may not exist yet)"
  sudo systemctl status paddock --no-pager || true
EOF

echo "✓ Deploy complete"
