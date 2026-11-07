# ==============================================================================
# Codebase Intelligence - Frontend Client Dockerfile
# ==============================================================================

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Require and set VITE_API_URL at build time for Vite client bundle
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN if [ -z "$VITE_API_URL" ]; then \
      echo "ERROR: VITE_API_URL build argument is required and cannot be empty" >&2; \
      exit 1; \
    fi

# Build Vite React SPA into /app/dist
RUN npm run build

# Production serve stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

