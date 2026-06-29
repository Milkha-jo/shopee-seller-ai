# syntax=docker/dockerfile:1
#
# API image. Build context MUST be the repository root so the sibling packages
# (calc-core, repositories, services) are available — the API's tsconfig path
# aliases (@core/@repo/@svc) resolve to ../calc-core/src, ../repositories/src and
# ../services/src. The server is run directly from TypeScript via tsx; no compile
# step is required and the runtime honours those tsconfig paths.
FROM node:22-slim AS base
ENV NODE_ENV=production
WORKDIR /app

# 1) Install production dependencies per package (manifests first for caching).
COPY calc-core/package.json calc-core/package-lock.json ./calc-core/
COPY repositories/package.json repositories/package-lock.json ./repositories/
COPY services/package.json services/package-lock.json ./services/
COPY api/package.json api/package-lock.json ./api/

RUN cd calc-core   && npm ci --omit=dev \
 && cd ../repositories && npm ci --omit=dev \
 && cd ../services     && npm ci --omit=dev \
 && cd ../api          && npm ci --omit=dev \
 && npm cache clean --force

# 2) Copy sources (sibling layout preserved).
COPY calc-core/   ./calc-core/
COPY repositories/ ./repositories/
COPY services/    ./services/
COPY api/         ./api/

# Run as the built-in non-root user.
USER node
WORKDIR /app/api
EXPOSE 4000

# PORT is provided by the environment (compose sets 4000). Graceful shutdown on
# SIGTERM/SIGINT is handled in src/server.ts.
CMD ["npm", "run", "start"]
