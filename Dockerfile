# ============================================================
# iResume — Multi-stage Docker build
# ============================================================

# --- Stage 1: Install dependencies ---
FROM node:20-alpine AS deps
WORKDIR /app

# Install openssl so Prisma detects the correct engine (openssl-3.0.x)
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Set DATABASE_URL for prisma generate (build-time only)
ENV DATABASE_URL="file:./data/dev.db"

RUN npm ci

# --- Stage 2: Build the application ---
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV DATABASE_URL="file:./data/dev.db"
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# --- Stage 3: Production runner ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:/app/data/dev.db"
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN apk add --no-cache openssl && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone server
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy prisma schema + migration tooling for runtime db push
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Copy pdfjs-dist runtime files (worker + CMap + fonts for Chinese PDF parsing)
COPY --from=builder /app/node_modules/pdfjs-dist/legacy/build ./node_modules/pdfjs-dist/legacy/build
COPY --from=builder /app/node_modules/pdfjs-dist/cmaps ./node_modules/pdfjs-dist/cmaps
COPY --from=builder /app/node_modules/pdfjs-dist/standard_fonts ./node_modules/pdfjs-dist/standard_fonts
COPY --from=builder /app/node_modules/pdfjs-dist/package.json ./node_modules/pdfjs-dist/package.json

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Create data directory for SQLite, set prisma engines writable
RUN mkdir -p /app/data && \
    chown -R nextjs:nodejs /app/data && \
    chown -R nextjs:nodejs /app/node_modules/.prisma && \
    chown -R nextjs:nodejs /app/node_modules/@prisma && \
    chown -R nextjs:nodejs /app/node_modules/prisma && \
    chown -R nextjs:nodejs /app/prisma

USER nextjs

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
