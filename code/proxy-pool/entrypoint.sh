#!/bin/bash
set -e

# 调度器放入后台持续采集代理 IP
echo "[proxy-pool] 启动代理采集调度器..."
python3 proxyPool.py schedule &

# API 服务前台运行，保持容器存活
echo "[proxy-pool] 启动 API 服务 (端口 5010)..."
exec python3 proxyPool.py server
