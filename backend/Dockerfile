# Stage 1: Build
FROM node:20.5.0-alpine3.18 AS builder

WORKDIR /app

# 1. Install all deps (including dev), generate Prisma client, build TS
COPY package.json package-lock.json tsconfig.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
RUN npm run build

# Stage 2: Production image
FROM node:20.5.0-alpine3.18

WORKDIR /app

# 2. Copy package files, install only prod deps, skip scripts
COPY package.json package-lock.json ./
RUN npm install --omit=dev --ignore-scripts

# 3. Copy built output and pre-generated Prisma client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# 4. Runtime config
ENV NODE_ENV=production
EXPOSE 8080
CMD ["npm", "start"]