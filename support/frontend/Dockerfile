# MolarPlus Support Tool — frontend image for Railway.
#
# Vite bakes VITE_API_URL at build time, so it must be present during `npm run
# build`. Railway exposes service variables as Docker build args, so we declare
# ARG VITE_API_URL and promote it to ENV before building. Node 20 also sidesteps
# the Node 18 / rollup / axios build failure seen on the Hetzner box.
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- Serve the built SPA -----------------------------------------------------
FROM node:20-slim
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
ENV PORT=8080
# `-s` rewrites all routes to index.html for the client-side router.
CMD ["sh", "-c", "serve -s dist -l ${PORT:-8080}"]
