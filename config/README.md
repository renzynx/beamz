# Reverse Proxy Configurations for Beam

This directory contains configuration files for various reverse proxy solutions to route `/api/*` requests to the API service and all other requests to the web application.

## Available Configurations

### 1. Caddy (Current)

- **Files**: `Caddyfile`, `docker-compose.yml`
- **Usage**: `docker compose up`
- **Features**: Automatic HTTPS, simple configuration
- **Admin**: N/A

### 2. Nginx

- **Files**: `nginx.conf`, `docker-compose.nginx.yml`
- **Usage**: `docker compose -f config/docker-compose.nginx.yml up`
- **Features**: High performance, widely used
- **Admin**: N/A

### 3. Traefik

- **Files**: `docker-compose.traefik.yml`
- **Usage**: `docker compose -f config/docker-compose.traefik.yml up`
- **Features**: Service discovery, automatic SSL, dynamic configuration
- **Admin**: http://localhost:8080 (dashboard)

### 4. Apache HTTP Server

- **Files**: `apache.conf`, `docker-compose.apache.yml`
- **Usage**: `docker compose -f config/docker-compose.apache.yml up`
- **Features**: Mature, feature-rich
- **Admin**: N/A

### 5. Envoy Proxy

- **Files**: `envoy.yaml`, `docker-compose.envoy.yml`
- **Usage**: `docker compose -f config/docker-compose.envoy.yml up`
- **Features**: Advanced load balancing, observability
- **Admin**: http://localhost:9901 (admin interface)

### 6. HAProxy

- **Files**: `haproxy.cfg`, `docker-compose.haproxy.yml`
- **Usage**: `docker compose -f config/docker-compose.haproxy.yml up`
- **Features**: High performance, load balancing
- **Admin**: http://localhost:8404/stats (stats page)

## How It Works

All configurations route traffic as follows:

- `GET /api/*` → Beam API service (port 3333)
- `GET /*` → Beam Web application (port 3000)

## Switching Between Proxies

1. Stop current containers: `docker compose down`
2. Start with different proxy: `docker compose -f config/docker-compose.[proxy].yml up`

## SSL/TLS

For production deployments, you'll want to add SSL/TLS configuration. Caddy and Traefik can handle this automatically with Let's Encrypt.
