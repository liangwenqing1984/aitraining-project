#!/bin/bash
set -e

# 从环境变量生成 Redis 连接配置
REDIS_HOST="${REDIS_HOST:-redis}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="${REDIS_PASSWORD:-pwd}"
REDIS_DB="${REDIS_DB:-0}"

echo "[proxy-pool] Redis: redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}/${REDIS_DB}"

# 生成 setting.py（jhao104/proxy_pool 通过此文件读取 Redis 连接）
cat > /app/setting.py << PYEOF
# 由 entrypoint.sh 自动生成
DB_CONN = 'redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}/${REDIS_DB}'

# API 服务配置
SERVER_HOST = '0.0.0.0'
SERVER_PORT = 5010

# 采集器配置
CYCLE_TEST = 100
PYEOF

echo "[proxy-pool] 启动代理采集调度器..."
python3 proxyPool.py schedule &

echo "[proxy-pool] 启动 API 服务 (端口 5010)..."
exec python3 proxyPool.py server
