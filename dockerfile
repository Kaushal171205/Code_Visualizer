# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Final Runtime System
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies (Compilers & Runtime)
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    build-essential \
    clang \
    g++ \
    openjdk-17-jdk-headless \
    python3 \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Setup Backend
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --only=production

# Copy Backend Source
COPY backend/ .

# Copy Built Frontend from Stage 1
COPY --from=frontend-builder /app/frontend/dist ../frontend/dist

# Environment & Start
ENV PORT=5000
ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "server.js"]
