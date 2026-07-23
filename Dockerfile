# Dockerfile for Worker Service (Kafka Consumer, Test Executor, Vulnerabilities Fetcher)
FROM node:20-alpine

WORKDIR /worker

# Install global tools
RUN npm install -g pnpm ts-node-dev

# Copy dependencies first
COPY package.json pnpm-lock.yaml ./

# Install dependencies (recreate lock if version mismatch)
RUN pnpm install

# Install utilities
RUN apk add --no-cache curl netcat-openbsd iputils

# Copy entire source code
COPY . .

EXPOSE 8001

# Start in dev mode
CMD ["pnpm", "run", "dev"]