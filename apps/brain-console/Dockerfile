# syntax=docker/dockerfile:1
#
# Multi-stage build for the ForgeOS brain-console.
# Build context is THIS directory (apps/brain-console); build/run from here:
#   docker build -t forgeos-brain-console .
#   docker compose up        # (docker-compose.yml lives alongside this file)
#
# Stage 1 (builder):  install deps and build the client bundle (dist/).
# Stage 2 (runtime):  serve with `npx tsx server.ts` on node:20-alpine.

# ---------------------------- Stage 1: builder ----------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Install root dependencies (this pulls dev deps too, including `tsx`,
# which the runtime stage needs to execute server.ts).
COPY package*.json ./
RUN npm install --no-audit --no-fund

# Bring in the rest of the application source.
COPY . .

# Build the client bundle using the project's own script:
#   build:client -> cd src/client && npm install && npm run build  (emits dist/)
RUN npm run build:client

# ---------------------------- Stage 2: runtime ----------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=7777

# `tsx` is a devDependency (it executes server.ts at runtime), so we copy the
# full node_modules from the builder rather than doing a production-only prune
# (which would drop tsx and break `npx tsx server.ts` with no network access).
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Built client assets + server source + app source (tsx compiles on the fly).
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public

EXPOSE 7777
CMD ["npx", "tsx", "server.ts"]
