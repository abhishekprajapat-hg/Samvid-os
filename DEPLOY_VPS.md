# The Office on Rent VPS Deployment (Alongside Existing Ecommerce App)

This guide deploys The Office on Rent without disturbing an already-hosted full-stack ecommerce project.

## Recommended Topology

- Keep ecommerce on its current domain/server block.
- Deploy The Office on Rent on a separate subdomain, for example:
  - ecommerce: `shop.example.com` (existing)
  - The Office on Rent: `crm.theofficeonrent.com` (new)
- Run The Office on Rent backend on a different internal port: `5100`.
- Serve The Office on Rent frontend static build via Nginx.
- Proxy `/api` and `/socket.io` to The Office on Rent backend.

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
sudo mkdir -p /var/www/the-office-on-rent
sudo chown -R $USER:$USER /var/www/the-office-on-rent
cd /var/www/the-office-on-rent
git clone <your-repo-url> .
```

Backend:

```bash
cd /var/www/the-office-on-rent/backend
npm ci --omit=dev
cp .env.example .env
```

Set production values in `backend/.env`:

- `PORT=5100`
- `MONGO_URI=...`
- `JWT_SECRET=...`
- `CORS_ORIGIN=https://crm.theofficeonrent.com`

Frontend:

```bash
cd /var/www/the-office-on-rent/frontend
npm ci
cp .env.production.example .env.production
npm run build
```

## 3. Start Backend with PM2

```bash
cd /var/www/the-office-on-rent
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
sudo cp /var/www/the-office-on-rent/deploy/nginx.the-office-on-rent.conf /etc/nginx/sites-available/the-office-on-rent
sudo ln -s /etc/nginx/sites-available/the-office-on-rent /etc/nginx/sites-enabled/the-office-on-rent
sudo nginx -t
sudo systemctl reload nginx
```

Then issue SSL certificate:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d crm.theofficeonrent.com
```

## 5. Update Flow (Zero Downtime Friendly)

```bash
cd /var/www/the-office-on-rent
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

- `backend/uploads/` holds user-uploaded files (inventory photos, floor plans, documents, chat
  media). It is gitignored and lives only on disk, so `git pull` / `pm2 reload` never touch it —
  but that also means it is **not** part of the repo and must be included in your own VPS backup
  routine (rsync/tar it alongside your MongoDB backups).
- Do not bind The Office on Rent backend to the same port used by ecommerce backend.
- Keep separate Nginx server blocks per app/subdomain.
- Keep `.env` out of Git and rotate secrets if ever exposed.
- If you prefer path-based hosting (`example.com/the-office-on-rent`), Nginx and Vite base-path changes are required.
- For reliable mobile WebRTC calling across NAT/mobile data, deploy a TURN server (coturn) and set:
  - `EXPO_PUBLIC_TURN_URL` / `EXPO_PUBLIC_TURN_URLS`
  - `EXPO_PUBLIC_TURN_USERNAME`
  - `EXPO_PUBLIC_TURN_CREDENTIAL`

