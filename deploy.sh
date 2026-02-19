#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PULL_CHANGES=true
INSTALL_DEPS=true

for arg in "$@"; do
  case "$arg" in
    --no-pull)
      PULL_CHANGES=false
      ;;
    --skip-install)
      INSTALL_DEPS=false
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: ./deploy.sh [--no-pull] [--skip-install]"
      exit 1
      ;;
  esac
done

echo "==> Starting deploy from: $ROOT_DIR"

if $PULL_CHANGES; then
  echo "==> Pulling latest code"
  git pull --ff-only
fi

if $INSTALL_DEPS; then
  echo "==> Installing backend dependencies"
  cd "$ROOT_DIR/backend"
  npm ci --omit=dev

  echo "==> Installing frontend dependencies"
  cd "$ROOT_DIR/frontend"
  npm ci
else
  echo "==> Skipping dependency install"
fi

echo "==> Building frontend"
cd "$ROOT_DIR/frontend"
npm run build

echo "==> Reloading backend (PM2)"
cd "$ROOT_DIR"
if pm2 describe samvid-backend >/dev/null 2>&1; then
  pm2 reload samvid-backend --update-env
else
  pm2 start deploy/ecosystem.config.cjs
fi

echo "==> Reloading Nginx"
if command -v systemctl >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1; then
    sudo systemctl reload nginx
  else
    systemctl reload nginx
  fi
else
  echo "systemctl not found, skipping nginx reload"
fi

echo "==> Deploy complete"
