#!/bin/bash
# ============================================================================
# 离线部署准备脚本 — 在有网环境运行一次，下载全部离线依赖
# ============================================================================
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "项目目录: $PROJECT_DIR"

# ---- Docker CLI 二进制 ----
echo ""
echo "[1/5] 下载 Docker CLI 静态二进制..."
DOCKER_VERSION="27.5.1"
DOCKER_URL="https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKER_VERSION}.tgz"

cd "$PROJECT_DIR"
if [ -f docker-bin/docker ]; then
  echo "  docker 二进制已存在，跳过"
else
  curl -fsSL "$DOCKER_URL" -o /tmp/docker.tgz
  tar xzf /tmp/docker.tgz -C /tmp
  cp /tmp/docker/docker docker-bin/docker
  rm -rf /tmp/docker.tgz /tmp/docker
  echo "  完成: docker-bin/docker"
fi

# ---- 代理池源码 ----
echo ""
echo "[2/5] 下载代理池源码 (jhao104/proxy_pool)..."
if [ -f code/proxy-pool/repo/proxyPool.py ]; then
  echo "  代理池源码已存在，跳过"
else
  git clone --depth=1 https://github.com/jhao104/proxy_pool.git /tmp/proxy_pool_dl
  cp -r /tmp/proxy_pool_dl/* code/proxy-pool/repo/
  rm -rf /tmp/proxy_pool_dl
  echo "  完成: code/proxy-pool/repo/"
fi

# ---- 代理池 pip wheels ----
echo ""
echo "[3/5] 下载代理池 Python 依赖 wheels..."
WHEELS_DIR="$PROJECT_DIR/code/proxy-pool/wheels"
REQ_FILE="$PROJECT_DIR/code/proxy-pool/repo/requirements.txt"

if [ -f "$REQ_FILE" ]; then
  EXISTING=$(ls "$WHEELS_DIR"/*.whl 2>/dev/null | wc -l)
  if [ "$EXISTING" -gt 2 ]; then
    echo "  wheels 已存在 ($EXISTING 个)，跳过"
  else
    pip3 download -d "$WHEELS_DIR" -r "$REQ_FILE"
    echo "  完成"
  fi
else
  echo "  请先运行 [2/5] 下载代理池源码"
fi

# ---- 训练器 pip wheels (torch + sentence-transformers) ----
echo ""
echo "[4/5] 下载训练器 ML 依赖 wheels (torch CPU + sentence-transformers)..."
WHEELS_DIR="$PROJECT_DIR/code/training/wheels"
EXISTING=$(ls "$WHEELS_DIR"/*.whl 2>/dev/null | wc -l)

if [ "$EXISTING" -gt 5 ]; then
  echo "  wheels 已存在 ($EXISTING 个)，跳过"
else
  pip3 download -d "$WHEELS_DIR" \
    torch sentence-transformers huggingface_hub \
    --index-url https://download.pytorch.org/whl/cpu \
    --extra-index-url https://pypi.org/simple
  echo "  完成"
fi

# ---- HuggingFace 预训练模型 ----
echo ""
echo "[5/5] 预下载 HuggingFace 模型（可选，训练时按需下载）..."
echo "  如需预下载常用模型，请运行:"
echo "    python3 scripts/download-hf-models.py --model nomic-ai/nomic-embed-text-v1.5"
echo "    python3 scripts/download-hf-models.py --model BAAI/bge-small-zh-v1.5"

echo ""
echo "=========================================="
echo "  离线依赖准备完成！"
echo "  将整个项目目录拷贝到离线环境即可。"
echo "=========================================="
