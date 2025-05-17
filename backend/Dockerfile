# Stage 1: Build
FROM node:20.5.0-alpine3.18 AS builder

WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
RUN npm run build

# Stage 2: Production image
FROM node:20.5.0-alpine3.18

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

ENV NODE_ENV=production
EXPOSE 8080
CMD ["npm", "start"]
