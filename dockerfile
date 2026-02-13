# Use Ubuntu base
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    clang \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Node (official way)
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Set working directory
WORKDIR /app

# Copy everything
COPY . .

# Install backend dependencies
WORKDIR /app/backend
RUN npm install

# Build frontend
WORKDIR /app/frontend
RUN npm install
RUN npm run build

# Go back to backend
WORKDIR /app/backend

# Expose port
EXPOSE 3000

# Start backend
CMD ["node", "server.js"]
