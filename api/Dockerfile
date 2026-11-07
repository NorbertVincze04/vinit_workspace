# VINIT API. Built by docker-compose.yml (service "api").
FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY tsconfig.json ./
COPY src ./src

USER node
EXPOSE 3000

# Apply pending migrations, then serve. (TypeScript runs through tsx, like in development.)
CMD ["sh", "-c", "node --import tsx src/scripts/migrate.ts latest && exec node --import tsx src/server.ts"]
