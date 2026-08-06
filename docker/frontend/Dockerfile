# Frontend Dockerfile (Next.js)
# Multi-stage for smaller final image
ARG NODE_ENV=production
FROM node:20-alpine AS base
WORKDIR /usr/src/app

FROM base AS deps
COPY apps/frontend/package.json apps/frontend/package-lock.json* ./
RUN npm ci --production

FROM base AS builder
COPY apps/frontend/ .
RUN npm ci
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=${NODE_ENV}
COPY --from=builder /usr/src/app/ .
EXPOSE 3000
# Use non-root user
USER node
CMD ["npm", "run", "start"]
