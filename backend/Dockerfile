FROM node:22-alpine AS dependencies

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --no-audit --no-fund

FROM node:22-alpine AS runtime

ENV NODE_ENV=development

WORKDIR /app/backend

COPY --from=dependencies /app/backend/node_modules ./node_modules
COPY backend/package.json backend/package-lock.json ./
COPY backend/ ./
COPY Datasets/ /app/Datasets/

EXPOSE 5000

CMD ["node", "server.js"]
