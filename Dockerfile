# Build stage
FROM oven/bun:1.2-alpine AS builder

WORKDIR /app

# Accept build-time env vars for Vite
ARG VITE_API_URL=""
ARG VITE_AUTH_SERVICE_URL="https://auth.vibeoholic.com"

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_AUTH_SERVICE_URL=$VITE_AUTH_SERVICE_URL

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Production stage
FROM nginxinc/nginx-unprivileged:alpine

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration (used as fallback; k8s overrides via ConfigMap)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 8080 (unprivileged nginx runs on 8080)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
