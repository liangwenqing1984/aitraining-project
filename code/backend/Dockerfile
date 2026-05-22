FROM node:20-bookworm

# Chrome/Chromium for Puppeteer + curl（docker CLI 下载用）
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    chromium-sandbox \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Docker CLI 静态二进制（用于 docker exec 调用训练容器）
RUN curl -fsSLo /tmp/docker.tgz https://download.docker.com/linux/static/stable/x86_64/docker-27.5.1.tgz \
    && tar xzf /tmp/docker.tgz -C /usr/local/bin --strip-components=1 docker/docker \
    && rm /tmp/docker.tgz \
    && chmod +x /usr/local/bin/docker

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
