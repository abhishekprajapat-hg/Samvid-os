#!/usr/bin/env bash
# Runs ON the VPS. Finds the Samvid OS checkout that PM2 is serving, pulls the
# latest main, rebuilds and reloads. Asks before changing anything.
set -euo pipefail

echo "==> Looking for the running Samvid OS app"
APP_DIR=""
PM2_NAME=""
if command -v pm2 >/dev/null 2>&1; then
  while IFS='|' read -r name cwd; do
    [ -z "$cwd" ] && continue
    root="$cwd"
    [ "$(basename "$root")" = "backend" ] && root="$(dirname "$root")"
    if [ -d "$root/.git" ] && git -C "$root" remote get-url origin 2>/dev/null | grep -qi "samvid-os"; then
      APP_DIR="$root"; PM2_NAME="$name"; break
    fi
  done < <(pm2 jlist 2>/dev/null | node -e '
    let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{for(const p of JSON.parse(s))console.log(p.name+"|"+(p.pm2_env&&p.pm2_env.pm_cwd||""))}catch(e){}})')
fi
if [ -z "$APP_DIR" ]; then
  for d in "$HOME/samvid-os" "$HOME/Samvid-os" /var/www/samvid-os /var/www/Samvid-os /var/www/samvid /opt/samvid-os; do
    if [ -d "$d/.git" ] && git -C "$d" remote get-url origin 2>/dev/null | grep -qi "samvid-os"; then APP_DIR="$d"; break; fi
  done
fi

echo "PM2 processes:"; pm2 ls 2>/dev/null || true
if [ -z "$APP_DIR" ]; then
  echo "!! Could not find a git checkout of Samvid-os on this server. Nothing was changed."
  echo "   Send this output to Claude."
  exit 2
fi

cd "$APP_DIR"
echo "==> App folder: $APP_DIR   (pm2: ${PM2_NAME:-not found})"
echo "==> Current commit: $(git log -1 --oneline)"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "!! The server checkout has local edits - not pulling over them:"
  git status --short --untracked-files=no | head -20
  exit 3
fi
git fetch origin main
echo "==> Will deploy: $(git log -1 --oneline origin/main)  ($(git rev-list --count HEAD..origin/main) new commits)"
read -r -p "Deploy now? [y/N] " answer
[ "$answer" = "y" ] || [ "$answer" = "Y" ] || { echo "Cancelled."; exit 1; }

PREVIOUS="$(git rev-parse HEAD)"
git pull --ff-only origin main

echo "==> Backend dependencies"
(cd backend && npm ci --omit=dev)
if [ -d frontend ]; then
  echo "==> Frontend build"
  (cd frontend && npm ci && npm run build)
fi

echo "==> Reloading backend"
if [ -n "$PM2_NAME" ]; then pm2 reload "$PM2_NAME" --update-env; else pm2 reload all --update-env; fi
sleep 5

PORT="$(grep -E '^PORT=' backend/.env 2>/dev/null | cut -d= -f2 | tr -d '\r' || true)"
PORT="${PORT:-5100}"
if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
  echo "==> Health check OK on port $PORT"
else
  echo "!! Health check failed on port $PORT. Roll back with:"
  echo "   cd $APP_DIR && git reset --hard $PREVIOUS && (cd backend && npm ci --omit=dev) && (cd frontend && npm ci && npm run build) && pm2 reload ${PM2_NAME:-all}"
  pm2 logs "${PM2_NAME:-}" --lines 30 --nostream 2>/dev/null || true
  exit 4
fi
if command -v nginx >/dev/null 2>&1; then sudo -n systemctl reload nginx 2>/dev/null || echo "(nginx reload skipped - static files are picked up without it)"; fi
echo "==> Deploy complete: $(git log -1 --oneline)"
