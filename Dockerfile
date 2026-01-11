# Dockerfile for Express
FROM node:latest

WORKDIR /api-gateway
COPY package.json /api-gateway
RUN pnpm install

# Install utilities
RUN apt-get update && apt-get install -y iputils-ping netcat-openbsd

COPY . /api-gateway

EXPOSE 3000
CMD ["pnpm", "run", "dev"]