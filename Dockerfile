FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package-lock.json package.json ./
RUN npm ci --omit=dev

COPY dist ./dist
COPY index.js ./

EXPOSE 3000
CMD ["node", "index.js"]
