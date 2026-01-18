# Dockerfile for Express
FROM node:latest

WORKDIR /api-gateway
COPY package.json /api-gateway
RUN npm install pnpm -g
RUN npm install ts-node-dev -g

# Install utilities
RUN apt-get update && apt-get install -y iputils-ping netcat-openbsd

COPY . /api-gateway

EXPOSE 3001
CMD ["pnpm", "run", "dev"]