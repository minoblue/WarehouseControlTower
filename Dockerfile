FROM node:26-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/mock-carrier/package.json apps/mock-carrier/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/event-contracts/package.json packages/event-contracts/package.json
COPY packages/logger/package.json packages/logger/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
ARG APP_NAME
COPY . .
RUN pnpm db:generate \
    && pnpm --filter "@warehouse/${APP_NAME}"... clean \
    && pnpm --filter "@warehouse/${APP_NAME}"... build

FROM node:26-alpine AS runtime
ARG APP_NAME
ENV NODE_ENV=production
ENV APP_NAME=$APP_NAME
ENV PATH=/app/node_modules/.bin:$PATH
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 appuser
COPY --from=build --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=appuser:nodejs /app/apps ./apps
COPY --from=build --chown=appuser:nodejs /app/packages ./packages
COPY --from=build --chown=appuser:nodejs /app/prisma ./prisma
COPY --from=build --chown=appuser:nodejs /app/package.json ./package.json
USER appuser
CMD ["sh", "-c", "node apps/$APP_NAME/dist/main.js"]
