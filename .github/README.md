# Beamz

Deployment guide — preferred: Docker Compose. Also includes manual deployment steps for advanced users.

## Overview

Beamz is a multi-service application consisting of:

- API service (internal port 3333)
- Web (Next.js) server (internal port 3000)
- Background jobs worker

The repository includes example proxy configurations (Caddy, Traefik, nginx, Apache, Envoy) in `config/` and an example `docker-compose.yml` at the repository root.

## Prerequisites

- Docker & Docker Compose (v2) installed
- (Manual only) bun installed (https://bun.sh)

## Recommended (preferred) — Docker Compose

This is the simplest and recommended way to deploy locally or on a server that supports Docker.

1. Clone the repo and change into it:

   ```sh
   git clone https://github.com/renzynx/beamz
   cd beamz
   ```

2. Configure (optional):
   - The default `docker-compose.yml` uses the image `ghcr.io/renzynx/beamz`.
   - If you want to run the built image locally, build it then use the compose file or update the `image:` value.

3. Environment variables (set via compose file or environment):
   - NODE_ENV=production
   - BASE_URL=http://localhost:3333 # DO NOT change this unless proxy is on a different host/port
   - SECRET=32-characters-random-string-for-secret

4. Volumes (compose) mount:
   - `./uploads:/app/uploads` — persistent file uploads
   - `./data:/app/data` — sqlite DB files

5. Start the stack (detached):

   ```sh
   docker compose up -d
   ```

6. Check logs (optional):

   ```sh
   docker compose logs -f
   ```

7. Access the app via the proxy on:

   http://localhost:3333

Notes:

- The example `config/Caddyfile` routes API requests under `/api/*` to the API and all other routes to the web server. Swap the proxy implementation by using the example docker-compose.\* files in `config/`.
- If you change ports in any service image, update the corresponding proxy configuration.

## Manual deployment (no Docker) — for advanced / debugging

This assumes you have `bun` installed and want to run the services directly on a linux host.

1. Install dependencies at repo root:

   ```sh
   bun install
   ```

2. Build packages:

   # Build DB

   ```sh
   cd packages/db
   bun run build
   ```

   # Build API

   ```sh
   cd ../api
   bun run build
   ```

   # Build background jobs

   ```sh
   cd ../background-jobs
   bun run build
   ```

   # Build web

   ```sh
   cd ../web
   NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 bun run build
   ```

   # copy web standalone assets

   ```sh
   cp -r public .next/standalone/packages/web/
   cp -r .next/static .next/standalone/packages/web/.next/static
   ```

3. Prepare runtime data and run migrations:

   ```sh
   cd ../../packages/db
   bun dist/migrate.js
   ```

4. Start services (backgrounding with & for linux shell; use a process manager in production):

   # API

   ```sh
   cd ../api
   bun dist/index.js &
   API_PID=$!
   ```

   # Web

   ```sh
   cd ../web
   bun .next/standalone/packages/web/server.js &
   WEB_PID=$!
   ```

   # Background jobs

   ```sh
   cd ../background-jobs
   bun dist/index.js &
   JOBS_PID=$!
   ```

   ```sh
   echo "API: $API_PID, WEB: $WEB_PID, JOBS: $JOBS_PID"
   ```

Important:

- Running multiple processes in one environment is fragile. Use systemd, supervisord, or container orchestration in production.
- The Docker image in this repo uses an Alpine-based Bun runtime. Bun's distroless images may lack shells or required libraries; testing your target runtime is recommended.

## Building the production Docker image locally

1. Build the image (from repository root):

   ```sh
   docker build -t <your-namespace>/beamz .
   ```

2. Optionally push to a registry:

   ```sh
   docker tag <your-namespace>/beamz ghcr.io/<your-namespace>/beamz:latest
   docker push ghcr.io/<your-namespace>/beamz:latest
   ```

3. Update `docker-compose.yml` `image:` field to point to your image or run the compose file using the built local image.

## Troubleshooting

- Proxy 502 / DNS lookup errors:
  - Make sure the proxy service uses the correct backend service name (the examples use `beamz`).
  - Ensure services are on the same Docker network as the proxy container.

- Logs:
  - Use `docker compose logs -f` to stream logs for all services.

## Files of interest

- `docker-compose.yml` — recommended compose file (uses `caddy` as proxy)
- `config/Caddyfile` — Caddy reverse proxy example
- `config/docker-compose.*.yml` — other proxy examples (traefik, nginx, apache, haproxy, envoy)

---

Access the app after starting compose at `http://localhost:3333`.
