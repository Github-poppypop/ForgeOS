# ============================================================
# Stage 1 — dependencies
# ============================================================
FROM node:20-alpine AS deps
WORKDIR /deps
RUN apk add --no-cache python3 make g++
COPY apps/brain-console/package.json apps/brain-console/bun.lock* ./brain-console/
WORKDIR /deps/brain-console
RUN if [ -f bun.lock ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# ============================================================
# Stage 2 — builder (no transpile needed; SPA is plain JS)
# ============================================================
FROM node:20-alpine AS builder
WORKDIR /build
COPY --from=deps /deps/brain-console/node_modules ./node_modules
COPY apps/brain-console/package.json apps/brain-console/bun.lock* ./
COPY apps/brain-console/public ./public
COPY apps/brain-console/src ./src
COPY apps/brain-console/server.ts ./

# ============================================================
# Stage 3 — runtime (smallest possible)
# ============================================================
FROM node:20-alpine AS runtime
LABEL org.opencontainers.image.source="https://github.com/forgeos/forgeos"
LABEL org.opencontainers.image.title="ForgeOS Brain Console"
LABEL org.opencontainers.image.description="VPS-first portable deploy of ForgeOS Brain Console"
ENV NODE_ENV=production \
    GBRAIN_HOME=/opt/forgeos/brain \
    GBRAIN_CWD=/opt/forgeos/gbrain-cli \
    PORT=7777

# Create non-root user
RUN addgroup -S forgeos && adduser -S -G forgeos forgeos

WORKDIR /app
COPY --from=builder --chown=forgeos:forgeos /build/node_modules ./node_modules
COPY --from=builder --chown=forgeos:forgeos /build/public ./public
COPY --from=builder --chown=forgeos:forgeos /build/src ./src
COPY --from=builder --chown=forgeos:forgeos /build/package.json ./
COPY --from=builder --chown=forgeos:forgeos /build/server.ts ./

EXPOSE 7777
USER forgeos

# Pre-flight: check gbrain path exists (runtime must mount volumes)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:7777/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.ts"]
