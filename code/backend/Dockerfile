FROM node:20-bookworm

# Chrome/Chromium for Puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    chromium-sandbox \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    CHROME_PATH=/usr/bin/chromium

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install && npm cache clean --force

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/
COPY chrome-path.js ./

# Build TypeScript，编译后删除源码和开发依赖
RUN npm run build \
    && rm -rf src/ tsconfig.json \
    && npm prune --production

EXPOSE 3004

CMD ["node", "dist/index.js"]
