FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
ENV DATABASE_URL="file:/tmp/build.db" NEXT_TELEMETRY_DISABLED=1
RUN npm ci
COPY . .
RUN npm run setup:ocr && npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 DATABASE_URL="file:/app/data/iresume.db" OCR_LANG_PATH="/app/tessdata" PORT=3000 HOSTNAME="0.0.0.0"
# Keep complete module resources: OCR and PDF workers load auxiliary files at runtime.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/tessdata ./tessdata
COPY --from=build /app/package.json /app/next.config.mjs ./
COPY docker-entrypoint.sh ./
RUN mkdir -p /app/data && chown -R node:node /app/data && chmod +x docker-entrypoint.sh
USER node
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
