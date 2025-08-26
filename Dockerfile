FROM oven/bun:1.2.18-alpine AS builder
WORKDIR /app

COPY package.json bun.lock* ./
COPY packages/db/package.json ./packages/db/
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/
COPY packages/web/next.config.ts ./packages/web/next.config.ts
COPY packages/background-jobs/package.json ./packages/background-jobs/

RUN bun install

COPY packages ./packages

# Build DB package
WORKDIR /app/packages/db
RUN bun run build

WORKDIR /app/packages/api
RUN bun run build

WORKDIR /app/packages/background-jobs
RUN bun run build

WORKDIR /app/packages/web
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build
RUN cp -r public .next/standalone/packages/web/ && cp -r .next/static .next/standalone/packages/web/.next/static

WORKDIR /app

FROM oven/bun:1.2.18-alpine AS ffmpeg-installer
WORKDIR /app
RUN echo '{"name": "ffmpeg-temp", "version": "1.0.0"}' > package.json
RUN bun add "@ffmpeg-installer/ffmpeg@^1.1.0"

FROM oven/bun:1.2.18-alpine AS runtime
WORKDIR /app

USER root
RUN mkdir -p /app/packages/db \
    /app/packages/api \
    /app/packages/web \
    /app/packages/background-jobs \
    /app/uploads \
    /app/data \
    /app/node_modules \
 && chown -R bun:bun /app

COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/migrations ./packages/db/migrations
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/background-jobs/dist ./packages/background-jobs/dist
COPY --from=builder /app/packages/web/.next/standalone/ ./packages/web/
COPY --from=ffmpeg-installer /app/node_modules/@ffmpeg-installer ./node_modules/@ffmpeg-installer

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production

RUN echo '#!/bin/sh' > /app/start.sh \
 && echo 'set -e' >> /app/start.sh \
 && echo 'echo "Running database migrations..."' >> /app/start.sh \
 && echo 'cd /app/packages/db && bun dist/migrate.js' >> /app/start.sh \
 && echo 'echo "Migrations completed, starting services..."' >> /app/start.sh \
 && echo 'cd /app/packages/api && bun dist/index.js &' >> /app/start.sh \
 && echo 'API_PID=$!' >> /app/start.sh \
 && echo 'cd /app/packages/web && bun ./packages/web/server.js &' >> /app/start.sh \
 && echo 'WEB_PID=$!' >> /app/start.sh \
 && echo 'cd /app/packages/background-jobs && bun dist/index.js &' >> /app/start.sh \
 && echo 'JOBS_PID=$!' >> /app/start.sh \
 && echo 'echo "All services started. API: $API_PID, Web: $WEB_PID, Jobs: $JOBS_PID"' >> /app/start.sh \
 && echo 'trap "kill $API_PID $WEB_PID $JOBS_PID 2>/dev/null || true" EXIT' >> /app/start.sh \
 && echo 'wait' >> /app/start.sh \
 && chmod +x /app/start.sh \
 && chown bun:bun /app/start.sh

USER bun
CMD ["/app/start.sh"]
