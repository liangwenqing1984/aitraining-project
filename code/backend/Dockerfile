FROM node:20-bookworm

# Chrome/Chromium for Puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    chromium-sandbox \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Python ML 依赖（torch CPU 版 + sentence-transformers，合并安装避免依赖冲突）
RUN pip3 install --no-cache-dir --break-system-packages \
    torch sentence-transformers huggingface_hub \
    --index-url https://download.pytorch.org/whl/cpu \
    --extra-index-url https://pypi.org/simple

# Tell Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    CHROME_PATH=/usr/bin/chromium

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY chrome-path.js ./

# Build TypeScript
RUN npm run build

EXPOSE 3004

CMD ["node", "dist/index.js"]
