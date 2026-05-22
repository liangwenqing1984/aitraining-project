FROM python:3.11-slim-bookworm

WORKDIR /app

# ==================== 第一步：获取代理池源码 ====================
# 先 COPY 本地目录（至少包含 .gitkeep，目录始终存在不会报错）
COPY repo/ /app/

# 检测 COPY 进来的有没有真实源码（没有 proxyPool.py 说明只有 .gitkeep，需在线下载）
RUN if [ ! -f /app/proxyPool.py ]; then \
      echo "在线下载代理池源码..."; \
      apt-get update && apt-get install -y --no-install-recommends git \
      && git clone --depth=1 https://github.com/jhao104/proxy_pool.git /tmp/proxy_pool \
      && cp -r /tmp/proxy_pool/* /app/ \
      && rm -rf /tmp/proxy_pool \
      && apt-get purge -y git && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*; \
    else \
      echo "代理池源码已从本地加载"; \
    fi

# ==================== 第二步：安装 Python 依赖 ====================
COPY wheels/ /wheels/

RUN if ls /wheels/*.whl >/dev/null 2>&1; then \
      echo "离线安装 Python 依赖..."; \
      pip3 install --no-cache-dir --no-index --find-links=/wheels/ -r requirements.txt \
      && rm -rf /wheels; \
    else \
      echo "在线安装 Python 依赖..."; \
      pip3 install --no-cache-dir -r requirements.txt; \
    fi

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 5010
ENTRYPOINT ["/entrypoint.sh"]
