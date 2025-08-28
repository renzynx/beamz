# syntax=docker/dockerfile:1.4
FROM oven/bun:1.2.18-alpine AS base

ARG TURBO_TEAM
ENV TURBO_TEAM=$TURBO_TEAM

FROM base AS builder
WORKDIR /app

RUN bun install --global turbo@^2

COPY . .

RUN turbo prune @beam/server @beam/background-jobs @beam/web --docker

FROM base AS installer
WORKDIR /app

# Install dependencies
COPY --from=builder /app/out/json/ .
RUN bun install

COPY --from=builder /app/out/full/ .
RUN --mount=type=secret,id=turbo_token \
  sh -c 'if [ -f /run/secrets/turbo_token ]; then export TURBO_TOKEN=$(cat /run/secrets/turbo_token); fi && \
    bun turbo run build'

# Ensure Next standalone has required public and static assets (if present)
WORKDIR /app/apps/web
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN cp -r public .next/standalone/apps/web/ && cp -r .next/static .next/standalone/apps/web/.next/static

WORKDIR /app

FROM golang:1.24.5-alpine AS gateway-builder
WORKDIR /src

# Copy only the gateway source from the builder stage to keep context small
COPY --from=builder /app/apps/gateway ./apps/gateway

# Install minimal deps and build a static binary
RUN apk add --no-cache ca-certificates git \
 && cd apps/gateway \
 && CGO_ENABLED=0 GOOS=linux go build -ldflags='-s -w' -o /app/gateway ./main.go

FROM base AS runtime
WORKDIR /app

USER root 

RUN addgroup --system --gid 1001 beam
RUN adduser --system --uid 1001 beam

RUN mkdir -p /app/uploads /app/data \
 && chown -R beam:beam /app/uploads /app/data

# Copy build outputs and web assets, set ownership to beam user
COPY --from=installer --chown=beam:beam /app/packages/database/migrations ./packages/database/migrations
COPY --from=installer --chown=beam:beam /app/packages/database/dist ./packages/database/dist
COPY --from=installer --chown=beam:beam /app/apps/server/dist ./apps/server/dist
COPY --from=installer --chown=beam:beam /app/apps/background-jobs/dist ./apps/background-jobs/dist
COPY --from=installer --chown=beam:beam /app/apps/web/.next/standalone/ ./apps/web/
COPY --from=installer --chown=beam:beam /app/node_modules/@ffmpeg-installer ./node_modules/@ffmpeg-installer

# Copy compiled gateway binary from gateway-builder stage
COPY --from=gateway-builder --chown=beam:beam /app/gateway ./apps/gateway/gateway

EXPOSE 8080

ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production

RUN echo '#!/bin/sh' > /app/start.sh \
 && echo 'set -e' >> /app/start.sh \
 && echo 'echo "Running database migrations..."' >> /app/start.sh \
 && echo 'cd /app/packages/database && bun dist/migrate.js' >> /app/start.sh \
 && echo 'echo "Migrations completed, starting services..."' >> /app/start.sh \
 && echo 'cd /app/apps/server && bun dist/index.js &' >> /app/start.sh \
 && echo 'API_PID=$!' >> /app/start.sh \
 && echo 'cd /app/apps/web && bun ./apps/web/server.js &' >> /app/start.sh \
 && echo 'WEB_PID=$!' >> /app/start.sh \
 && echo 'cd /app/apps/background-jobs && bun dist/index.js &' >> /app/start.sh \
 && echo 'JOBS_PID=$!' >> /app/start.sh \
 && echo 'cd /app/apps/gateway && ./gateway &' >> /app/start.sh \
 && echo 'GATEWAY_PID=$!' >> /app/start.sh \
 && echo 'echo "All services started. API: $API_PID, Web: $WEB_PID, Jobs: $JOBS_PID, GATEWAY: $GATEWAY_PID"' >> /app/start.sh \
 && echo 'trap "kill $API_PID $WEB_PID $JOBS_PID $GATEWAY_PID 2>/dev/null || true" EXIT' >> /app/start.sh \
 && echo 'wait' >> /app/start.sh \
 && chmod +x /app/start.sh \
 && chown beam:beam /app/start.sh

USER beam

CMD ["/app/start.sh"]
