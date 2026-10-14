# The API and the engine: one image, started with APP_ROLE=all | api | engine (docs/operations/DEPLOYMENT.md).
# Build from the repository root:  docker build -f api/Dockerfile -t botrts-api .
FROM node:20-bookworm-slim AS build
WORKDIR /app
# Prisma's engines need OpenSSL
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Only the manifests first, so that the dependency layer is cached until they change. The client is a workspace of the repository
# but is not part of this image, so its manifest is only there to let npm resolve the lock file.
COPY package.json package-lock.json ./
COPY lib/package.json lib/
COPY api/package.json api/
COPY client/package.json client/
COPY mcp/package.json mcp/
COPY api/prisma api/prisma
# The install scripts build bcrypt and generate the Prisma client
RUN npm ci --workspace lib --workspace api

COPY lib lib
COPY api api
RUN npm run build -w api

FROM node:20-bookworm-slim
WORKDIR /app/api
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
# The dependencies stay complete (not pruned): the Prisma CLI that applies the migrations (`npx prisma migrate deploy`) is one
COPY --from=build /app/node_modules /app/node_modules
# Packages that npm could not hoist (a different version is hoisted for another workspace)
COPY --from=build /app/api/node_modules ./node_modules
COPY --from=build /app/package.json /app/
COPY --from=build /app/lib /app/lib
COPY --from=build /app/api/package.json ./
COPY --from=build /app/api/prisma ./prisma
COPY --from=build /app/api/ts-built ./ts-built
# Logs go to the console in a container
ENV LOG_FILE=false PORT=8080
EXPOSE 8080
USER node
CMD ["node", "ts-built/api/index.js"]
