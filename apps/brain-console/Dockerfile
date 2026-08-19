# syntax=docker/dockerfile:1
# Build context for this Dockerfile is the repository root (per docker-compose).
# All COPY paths are relative to that root (e.g. apps/brain-console/...).

# ---- Stage 1: build client ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install root app deps first (better layer caching)
COPY apps/brain-console/package*.json ./
RUN npm ci --no-audit --no-fund

# Bring in the full app source
COPY apps/brain-console/ ./

# Build the client bundle (assumes a src/client workspace with its own manifest)
RUN cd src/client && npm ci --no-audit --no-fund && npm run build

# ---- Stage 2: runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=7777

# Production-only dependencies
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Full app (built client + server source) from the builder stage
COPY --from=builder /app/ ./

EXPOSE 7777
CMD ["npx", "tsx", "server.ts"]
