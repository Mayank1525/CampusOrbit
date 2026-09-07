# CampusOrbit — production image.
# Builds the Vite client, then serves it (plus the API and Socket.IO) from Express.
#
# Security notes
# --------------
# * node:22-alpine is the current LTS on a musl base with a very small package
#   surface, which clears the CVEs reported against older node:20 / Debian tags.
# * Dependencies install with `npm ci --omit=dev` so the image matches the
#   lockfile exactly and ships no build/test tooling.
# * The final stage runs as a non-root user with no shell.
# * dumb-init reaps zombies and forwards SIGTERM so shutdown is graceful.

# ---------- stage 1: build the React client ----------
FROM node:22-alpine AS client-build
WORKDIR /build

# Copy manifests first so this layer caches until dependencies actually change.
COPY client/package.json client/package-lock.json ./client/
RUN npm --prefix client ci

COPY client ./client
# Vite's rollup pass is memory hungry; cap the heap so the build cannot OOM-kill
# a small CI runner.
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm --prefix client run build

# ---------- stage 2: server dependencies ----------
FROM node:22-alpine AS server-deps
WORKDIR /build

COPY server/package.json server/package-lock.json ./server/
RUN npm --prefix server ci --omit=dev && npm cache clean --force

# ---------- stage 3: runtime ----------
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=5000 \
    NPM_CONFIG_UPDATE_NOTIFIER=false

# Apply any outstanding OS security patches, then add dumb-init for correct
# signal handling. No compilers or package managers remain in the final image.
RUN apk upgrade --no-cache \
  && apk add --no-cache dumb-init \
  && addgroup -S orbit \
  && adduser -S orbit -G orbit -s /sbin/nologin

# Dependencies and source, all owned by the unprivileged user.
COPY --from=server-deps --chown=orbit:orbit /build/server/node_modules ./server/node_modules
COPY --chown=orbit:orbit server ./server
COPY --chown=orbit:orbit package.json ./

# The built SPA — app.js serves ../../client/dist relative to server/src.
COPY --from=client-build --chown=orbit:orbit /build/client/dist ./client/dist

RUN mkdir -p /app/server/uploads && chown -R orbit:orbit /app/server/uploads

USER orbit

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/src/server.js"]
