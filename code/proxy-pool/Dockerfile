FROM python:3.11-slim-bookworm

# 安装 git（克隆代理池源码用）
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 克隆 jhao104/proxy_pool 并安装依赖
RUN git clone --depth=1 https://github.com/jhao104/proxy_pool.git /app \
    && pip3 install --no-cache-dir -r requirements.txt

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 5010

ENTRYPOINT ["/entrypoint.sh"]
