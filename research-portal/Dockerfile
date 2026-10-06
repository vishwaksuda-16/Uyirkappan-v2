FROM node:22-alpine AS dependencies

WORKDIR /app/research-portal

COPY research-portal/package.json research-portal/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

WORKDIR /app/hospital-dashboard

COPY hospital-dashboard/package.json hospital-dashboard/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --no-audit --no-fund

FROM node:22-alpine AS runtime

ENV NODE_ENV=development

WORKDIR /app/research-portal

COPY --from=dependencies /app/research-portal/node_modules ./node_modules
COPY --from=dependencies /app/hospital-dashboard/node_modules /app/hospital-dashboard/node_modules
COPY research-portal/package.json research-portal/package-lock.json ./
COPY hospital-dashboard/package.json hospital-dashboard/package-lock.json /app/hospital-dashboard/
COPY research-portal/ ./
COPY hospital-dashboard/src/ /app/hospital-dashboard/src/

EXPOSE 5174

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5174"]
