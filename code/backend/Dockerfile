FROM aitrain-base:latest

WORKDIR /app

# 安装依赖（离线环境需保证 package.json 未变，使用预构建的镜像缓存）
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package.json package-lock.json* ./
RUN npm install && npm cache clean --force

# 复制源码
COPY tsconfig.json ./
COPY src/ ./src/
COPY chrome-path.js ./

# 生产模式：编译 → 删源码 → 清开发依赖；开发模式：保留源码和 tsx
ARG NODE_ENV=production
RUN if [ "$NODE_ENV" != "development" ]; then \
      npm run build \
      && rm -rf src/ tsconfig.json \
      && npm prune --production; \
    fi

EXPOSE 3004

CMD if [ "$NODE_ENV" = "development" ]; then \
      npx tsx watch src/index.ts; \
    else \
      node dist/index.js; \
    fi
