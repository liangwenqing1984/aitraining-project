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
# -*- coding: utf-8 -*-

# 数据库连接（Redis）
DB_CONN = 'redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}/${REDIS_DB}'

# Redis 中存储代理的表名
TABLE_NAME = 'use_proxy'

# API 服务配置
HOST = '0.0.0.0'
PORT = 5010

# 代理采集方法（免费源，按需开启）
PROXY_FETCHER = [
    "freeProxy01", "freeProxy02", "freeProxy03",
    "freeProxy04", "freeProxy05", "freeProxy06",
    "freeProxy07", "freeProxy08", "freeProxy09",
    "freeProxy10", "freeProxy11",
]

# 代理验证目标
HTTP_URL = "http://httpbin.org/get"
HTTPS_URL = "https://www.qq.com"

# 调度器配置
CYCLE_TEST = 100
MAX_FAIL_COUNT = 0
POOL_SIZE_MIN = 30

# 时区
TIMEZONE = "Asia/Shanghai"

# 版本和横幅
VERSION = "2.4.0"
BANNER = r"""
*******************************************************************
*** | ___ \\_ ******************** | ___ \\ ********* | | ********
*** | |_/ / \\__ __ __ _ __ _ | |_/ /___ * ___  | | ********
*** |  __/|  _// _ \\ \\ \\/ /| | | ||  __// _ \\ / _ \\ | | ********
*** | |   | | | (_) | >  < \\ |_| || |  | (_) | (_) || |___  ****
*** \\_|   |_|  \\___/ /_/\\_\\ \\__  |\\_|   \\___/ \\___/ \\_____/ ****
****                       __ / /                          *****
************************* /___ / *******************************
"""
PYEOF

echo "[proxy-pool] 启动代理采集调度器..."
python3 proxyPool.py schedule &

echo "[proxy-pool] 启动 API 服务 (端口 5010)..."
exec python3 proxyPool.py server
