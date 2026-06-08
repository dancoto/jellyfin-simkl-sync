# Use the official lightweight Bun image on Alpine Linux
FROM oven/bun:1-alpine

# Install timezone data
RUN apk add --no-cache tzdata

# Set working directory inside the container
WORKDIR /usr/src/app

# Copy package files and lockfile first to leverage Docker build cache
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy the rest of the application source code
COPY . .

# Use non-root user for security
USER bun

# Expose webhook port
EXPOSE 3000

# Final command to start the application
CMD [ "bun", "index.ts" ]
