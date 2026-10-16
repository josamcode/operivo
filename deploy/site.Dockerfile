# Static build of the public landing page (apps/site) served by nginx.
# Build from the repository root: docker build -f deploy/site.Dockerfile .
FROM node:24-bookworm-slim AS build
ENV CI=true \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install -g pnpm@11.17.0
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter "@opervio/site..."
RUN pnpm --filter @opervio/site build

FROM nginx:1.29-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/site/dist /usr/share/nginx/html
EXPOSE 80
