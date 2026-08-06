# ==========================
# Backend Dockerfile (NestJS)
# ==========================

ARG NODE_ENV=production

# ==========================
# Builder
# ==========================

FROM node:20-bookworm-slim AS builder

WORKDIR /usr/src/app

# Install tools untuk compile native module (argon2)
RUN apt-get update && \
    apt-get install -y \
        python3 \
        make \
        g++ && \
    rm -rf /var/lib/apt/lists/*

# Agar node-gyp menemukan python
ENV PYTHON=/usr/bin/python3

# Copy package files
COPY apps/backend/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY apps/backend/ ./

# Build NestJS
RUN npm run build

# ==========================
# Runtime
# ==========================

FROM node:20-bookworm-slim AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Runtime library untuk argon2
RUN apt-get update && \
    apt-get install -y libstdc++6 && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY --from=builder /usr/src/app/package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy hasil build
COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/main.js"]