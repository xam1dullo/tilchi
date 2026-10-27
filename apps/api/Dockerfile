FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@11.17.0 --activate
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY packages/content/package.json packages/content/package.json
RUN pnpm install --frozen-lockfile --filter @tilchi/api...
COPY apps/api apps/api
RUN pnpm --filter @tilchi/api build
RUN pnpm --filter @tilchi/api deploy --prod /out

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out /app
COPY --from=build /repo/apps/api/dist ./dist
EXPOSE 3001
CMD ["node", "dist/main.js"]
