# Use the official lightweight Bun image on Alpine Linux
FROM oven/bun:1-alpine

# Install timezone data
RUN apk add --no-cache tzdata

# Create /config and app directories with proper permissions for the bun user
RUN mkdir -p /config /usr/src/app && chown -R bun:bun /config /usr/src/app

# Set working directory inside the container
WORKDIR /usr/src/app

# Copy package files and lockfile first to leverage Docker build cache
COPY --chown=bun:bun package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy the rest of the application source code
COPY --chown=bun:bun . .

# Use non-root user for security
USER bun

# Expose web UI & webhook port
EXPOSE 3000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

# Final command to start the application
CMD [ "bun", "index.ts" ]
