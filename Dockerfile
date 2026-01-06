FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/
COPY cards ./cards/

RUN npm install

# Generate Prisma client
RUN npx prisma generate

COPY src ./src

RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./
COPY cards ./cards/
COPY prisma ./prisma/

RUN npm install --only=production

# Install Prisma CLI for migrations
RUN npm install prisma --save-dev

# Generate Prisma client for production
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3300

ENV NODE_ENV=production
ENV PORT=3300
ENV HOST=0.0.0.0

ENTRYPOINT ["docker-entrypoint.sh"]

