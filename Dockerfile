# Stage 1: compilar TypeScript
FROM node:22-alpine AS builder
WORKDIR /app
COPY src/package*.json src/tsconfig.json ./
RUN npm ci
COPY src/*.ts src/config.json ./
RUN npm run build

# Stage 2: imagen de producción
FROM node:22-alpine AS runtime

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN apk add --no-cache \
    ca-certificates \
    chromium \
    freetype \
    harfbuzz \
    nss \
    ttf-freefont

WORKDIR /app

COPY src/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY run.sh ./
RUN chmod +x run.sh

CMD ["./run.sh"]
