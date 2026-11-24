FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY shared ./shared
COPY public ./public
COPY src ./src
RUN npm run build:web

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
ENV DIST_DIR=/app/dist
COPY --from=builder /app/dist ./dist
COPY server ./server
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
CMD ["node", "server/index.mjs"]
