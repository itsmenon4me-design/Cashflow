# Frontend Dockerfile (Next.js)
# Monorepo (npm workspaces) aware: install once from the root lockfile.
ARG NODE_ENV=production

# ==========================
# Builder
# ==========================

FROM node:22-alpine AS builder

WORKDIR /app

# Copy package manifests + single root lockfile
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json

RUN npm ci

COPY apps/frontend ./apps/frontend

# Bake the public API URL at build time
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

ARG NODE_ENV
ENV NODE_ENV=${NODE_ENV}

RUN npm run build -w frontend

# ==========================
# Runner
# ==========================

FROM node:22-alpine AS runner

WORKDIR /app

ARG NODE_ENV
ENV NODE_ENV=${NODE_ENV}

# Copy the full monorepo node_modules
COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/apps/frontend ./apps/frontend
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/frontend/package.json ./apps/frontend/package.json

# Non-root user
USER node

EXPOSE 3000

CMD ["npm", "run", "start", "-w", "frontend"]