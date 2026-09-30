# ---- build: フロントエンドをビルド ----
FROM node:20-slim AS build

WORKDIR /app
COPY package-lock.json package.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- runtime: サーバーのみ ----
FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package-lock.json package.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY index.js ./

EXPOSE 3000
CMD ["node", "index.js"]
