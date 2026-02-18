# Samvid OS VPS Deployment (Alongside Existing Ecommerce App)

This guide deploys Samvid without disturbing an already-hosted full-stack ecommerce project.

## Recommended Topology

- Keep ecommerce on its current domain/server block.
- Deploy Samvid on a separate subdomain, for example:
  - ecommerce: `shop.example.com` (existing)
  - samvid: `samvid.example.com` (new)
- Run Samvid backend on a different internal port: `5100`.
- Serve Samvid frontend static build via Nginx.
- Proxy `/api` and `/socket.io` to Samvid backend.

## 1. Server Prerequisites

Install once:

```bash
sudo apt update
sudo apt install -y nginx git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

## 2. Clone and Install

```bash
sudo mkdir -p /var/www/samvid-os
sudo chown -R $USER:$USER /var/www/samvid-os
cd /var/www/samvid-os
git clone <your-repo-url> .
```

Backend:

```bash
cd /var/www/samvid-os/backend
npm ci --omit=dev
cp .env.example .env
```

Set production values in `backend/.env`:

- `PORT=5100`
- `MONGO_URI=...`
- `JWT_SECRET=...`
- `CORS_ORIGIN=https://samvid.example.com`

Frontend:

```bash
cd /var/www/samvid-os/frontend
npm ci
cp .env.production.example .env.production
npm run build
```

## 3. Start Backend with PM2

```bash
cd /var/www/samvid-os
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup
```

Health check:

```bash
curl http://127.0.0.1:5100/api/health
```

## 4. Nginx Configuration

Copy and enable:

```bash
sudo cp /var/www/samvid-os/deploy/nginx.samvid.conf /etc/nginx/sites-available/samvid
sudo ln -s /etc/nginx/sites-available/samvid /etc/nginx/sites-enabled/samvid
sudo nginx -t
sudo systemctl reload nginx
```

Then issue SSL certificate:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d samvid.example.com
```

## 5. Update Flow (Zero Downtime Friendly)

```bash
cd /var/www/samvid-os
git pull

cd backend
npm ci --omit=dev

cd ../frontend
npm ci
npm run build

cd ..
pm2 reload deploy/ecosystem.config.cjs --update-env
sudo systemctl reload nginx
```

## 6. Important Notes

- Do not bind Samvid backend to the same port used by ecommerce backend.
- Keep separate Nginx server blocks per app/subdomain.
- Keep `.env` out of Git and rotate secrets if ever exposed.
- If you prefer path-based hosting (`example.com/samvid`), Nginx and Vite base-path changes are required.

