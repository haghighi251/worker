# ──────────────────────────────────────────────────────────────────────────
# DEVELOPMENT image for worker.
#
# Built from the monorepo root (see docker-compose.dev.yml: context: .,
# dockerfile: worker/Dockerfile) because worker depends on the workspace
# package "@aba/database": "workspace:*". pnpm can only resolve that
# dependency when it can see pnpm-workspace.yaml and the other workspace
# members' package.json files, which don't exist inside ./worker alone.
# Mirrors the same pattern used by aba-bl/Dockerfile.dev.
# ──────────────────────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Pin pnpm to the version that wrote the workspace lockfile (lockfileVersion 9.0).
# An unpinned "npm install -g pnpm" grabs whatever is latest at build time, and
# an older pnpm (e.g. 8.x) cannot read this lockfile: it silently re-resolves
# dependencies (picking an old Prisma that rejects the schema's block comments).
# Dependency build-script approvals and blockExoticSubdeps live in pnpm-workspace.yaml.
RUN npm install -g pnpm@12.8.2 ts-node-dev

# ------------------------------------------------------------
# CRITICAL: Create the root package.json BEFORE pnpm install.
# pnpm needs a root package.json to recognise the workspace root.
# ------------------------------------------------------------
RUN printf '{"name":"aba-monorepo","private":true}' > /app/package.json

# Copy workspace manifests and package.json files
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY worker/package.json ./worker/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/database/prisma ./packages/database/prisma

# Install ALL workspace dependencies (do NOT use --filter)
RUN pnpm install

# Install utilities
RUN apk add --no-cache curl netcat-openbsd iputils

# Copy the rest of the source code
COPY worker ./worker
COPY packages/database ./packages/database

# Compile the shared @aba/database package to JS so it can be required at
# runtime (its "main"/"types" point at dist/, not the raw TypeScript source).
RUN pnpm --filter @aba/database build

WORKDIR /app/worker

EXPOSE 8001

# Start in dev mode
CMD ["pnpm", "run", "dev"]
