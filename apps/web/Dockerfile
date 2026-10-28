FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@11.17.0 --activate
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY packages/content/package.json packages/content/package.json
RUN pnpm install --frozen-lockfile --filter @tilchi/web...
COPY apps/web apps/web
COPY packages/content packages/content
RUN pnpm --filter @tilchi/web build
# The SSR bundle keeps react, react-dom, and TanStack external.
RUN pnpm --filter @tilchi/web deploy --prod --legacy /out

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out /app
COPY --from=build /repo/apps/web/dist ./dist
COPY --from=build /repo/apps/web/serve.mjs ./serve.mjs
USER node
EXPOSE 3000
CMD ["node", "serve.mjs"]
