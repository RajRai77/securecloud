# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Runtime stage ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Non-root user
RUN addgroup -S securecloud && adduser -S securecloud -G securecloud

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

RUN mkdir -p /app/tmp && chown -R securecloud:securecloud /app
USER securecloud

EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --retries=10 --start-period=20s \
  CMD node dist/utils/healthcheck.js

CMD ["node", "dist/index.js"]
