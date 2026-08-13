# ==========================
# Backend Dockerfile (NestJS)
# Monorepo (npm workspaces) aware: install once from the root lockfile.
# ==========================

ARG NODE_ENV=production

# ==========================
# Builder
# ==========================

FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install tools untuk compile native module (argon2)
RUN apt-get update && \
    apt-get install -y \
        python3 \
        make \
        g++ && \
    rm -rf /var/lib/apt/lists/*

# Agar node-gyp menemukan python
ENV PYTHON=/usr/bin/python3

# Copy package manifests (all workspace members) + single root lockfile
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json

# Install dependencies for the whole monorepo from the root lockfile
RUN npm ci

# Copy Prisma schema/config + backend source
COPY prisma ./prisma
COPY prisma.config.ts ./

COPY apps/backend ./apps/backend

# Generate Prisma client into apps/backend/src/generated/prisma
RUN npx prisma generate

# Build NestJS
ARG NODE_ENV
ENV NODE_ENV=${NODE_ENV}
RUN npm run build -w backend

# ==========================
# Runtime
# ==========================

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ARG NODE_ENV
ENV NODE_ENV=${NODE_ENV}

# Runtime library untuk argon2 + curl untuk healthcheck
RUN apt-get update && \
    apt-get install -y libstdc++6 curl && \
    rm -rf /var/lib/apt/lists/*

# Copy the full monorepo node_modules (installed from root lockfile)
COPY --from=builder /app/node_modules ./node_modules

# Copy backend build output + generated client
COPY --from=builder /app/apps/backend ./apps/backend

# Copy Prisma schema/config/seed (used by migrate deploy + db seed)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

COPY docker/backend/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["./entrypoint.sh"]