# ============================================================
# Stage 1 — dependencies
# ============================================================
FROM node:20-alpine AS deps
WORKDIR /deps
RUN apk add --no-cache python3 make g++
COPY apps/brain-console/package.json ./
RUN npm install --omit=dev

# ============================================================
# Stage 2 — client build
# ============================================================
FROM node:20-alpine AS client-builder
WORKDIR /build/client
COPY apps/brain-console/package.json ./
RUN npm install
COPY apps/brain-console/src/client ./src/client
WORKDIR /build/client/src/client
RUN npm run build

# ============================================================
# Stage 3 — runtime
# ============================================================
FROM node:20-alpine AS runtime
LABEL org.opencontainers.image.source="https://github.com/forgeos/forgeos"
LABEL org.opencontainers.image.title="ForgeOS Brain Console"
LABEL org.opencontainers.image.description="VPS-first portable deploy of ForgeOS Brain Console"
ENV NODE_ENV=production \
    GBRAIN_HOME=/opt/forgeos/brain \
    GBRAIN_CWD=/opt/forgeos/gbrain-cli \
    PORT=7777

RUN addgroup -S forgeos && adduser -S -G forgeos forgeos
WORKDIR /app

COPY --from=deps --chown=forgeos:forgeos /deps/node_modules ./node_modules
COPY --from=client-builder --chown=forgeos:forgeos /build/client/src/client/dist ./dist
COPY --from=client-builder --chown=forgeos:forgeos /build/client/src/client/public ./public
COPY apps/brain-console/server.ts ./
COPY apps/brain-console/src/server ./src/server
COPY apps/brain-console/package.json ./

EXPOSE 7777
USER forgeos

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:7777/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.ts"]
