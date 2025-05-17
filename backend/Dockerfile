# Stage 1: Build
FROM node:20.5.0-alpine3.18

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package.json package-lock.json tsconfig.json ./
RUN npm install

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source code and build
COPY src ./src
RUN npm run build

# Stage 2: Production image
FROM node:20.5.0-alpine3.18
WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# Copy built files and Prisma schema + client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Set environment
ENV NODE_ENV=production
EXPOSE 8080

# Start the server
CMD ["npm", "start"]