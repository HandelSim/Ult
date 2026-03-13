FROM node:20-slim

# Install system dependencies for development and Claude Code
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    python3-pip \
    curl \
    wget \
    build-essential \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally - the core execution engine
RUN npm install -g @anthropic-ai/claude-code

# Set working directory
WORKDIR /app

# Copy package files first for better Docker layer caching
# Install dependencies before copying source (dependencies change rarely)
COPY package.json ./
COPY tsconfig.json ./
COPY src/client/package.json ./src/client/
COPY src/server/package.json ./src/server/
COPY src/server/tsconfig.server.json ./src/server/

# Install all dependencies (monorepo workspaces)
RUN npm install
RUN cd src/server && npm install
RUN cd src/client && npm install

# Copy source code
COPY src/ ./src/
COPY scripts/ ./scripts/

# Build backend (TypeScript -> JavaScript)
RUN cd src/server && npx tsc -p tsconfig.server.json

# Copy schema.sql to dist (not compiled by tsc)
RUN mkdir -p dist/server/db && cp src/server/db/schema.sql dist/server/db/schema.sql

# Build frontend (Vite production build)
RUN cd src/client && npx vite build

# Make Python scripts executable
RUN chmod +x scripts/*.py

# Create required directories
RUN mkdir -p /workspace /app/data

# Expose ports:
# 3000 - Frontend static files
# 3001 - Backend API
EXPOSE 3000 3001

# Start the production server (serves both frontend and API)
CMD ["node", "dist/server/index.js"]
