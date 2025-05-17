# Stage 1: Build
FROM node:20.5.0-alpine3.18 AS builder
WORKDIR /app

# 1. Copy project files, Prisma schema, server entrypoint, and source
COPY package.json package-lock.json tsconfig.json ./
COPY prisma            ./prisma
COPY server.ts         ./
COPY src               ./src

# 2. Install all deps, generate Prisma client, compile TS
RUN npm install
RUN npx prisma generate
RUN npm run build

# Stage 2: Production
FROM node:20.5.0-alpine3.18
WORKDIR /app

# 3. Copy package files & install only prod deps (skip scripts)
COPY package.json package-lock.json ./
RUN npm install --omit=dev --ignore-scripts

# 4. Copy built code, Prisma schema, and generated client
COPY --from=builder /app/dist                     ./dist
COPY --from=builder /app/prisma                   ./prisma
COPY --from=builder /app/src/generated/prisma-client ./dist/src/generated/prisma-client

# 5. Runtime settings
ENV NODE_ENV=production
EXPOSE 8080

# 6. Start the server
CMD ["node", "dist/server.js"]