# Stage 1: Build
FROM node:20.5.0-alpine3.18 AS builder

WORKDIR /app

# 1. Copy package files + Prisma schema upfront
COPY package.json package-lock.json tsconfig.json ./
COPY prisma ./prisma

# 2. Install all deps (will run postinstall: prisma generate)
RUN npm install

# 3. Copy source and compile TS
COPY src ./src
RUN npm run build

# Stage 2: Production image
FROM node:20.5.0-alpine3.18

WORKDIR /app

# 4. Copy package files and install only prod deps, skipping hooks
COPY package.json package-lock.json ./
RUN npm install --omit=dev --ignore-scripts

# 5. Copy built code + pre‐generated Prisma client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# 6. Final setup
ENV NODE_ENV=production
EXPOSE 8080
CMD ["npm", "start"]