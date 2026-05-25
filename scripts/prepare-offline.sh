#!/bin/bash
# ============================================================================
# 离线部署准备脚本 — 在有网环境运行一次，下载全部离线依赖
# 依赖：docker（用容器下载 pip wheels，不依赖宿主机 Python/SSL）
# ============================================================================
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "项目目录: $PROJECT_DIR"

# ---- Docker CLI 静态二进制 ----
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

# ---- 代理池 pip wheels（通过 Docker 容器下载，无需宿主机 Python） ----
echo ""
echo "[3/5] 下载代理池 Python 依赖 wheels..."
WHEELS_DIR="$PROJECT_DIR/code/proxy-pool/wheels"
REPO_DIR="$PROJECT_DIR/code/proxy-pool/repo"

if [ -f "$REPO_DIR/requirements.txt" ]; then
  EXISTING=$(ls "$WHEELS_DIR"/*.whl 2>/dev/null | wc -l)
  if [ "$EXISTING" -gt 2 ]; then
    echo "  wheels 已存在 ($EXISTING 个)，跳过"
  else
    docker run --rm \
      -v "$REPO_DIR:/repo:ro" \
      -v "$WHEELS_DIR:/wheels" \
      python:3.11-slim-bookworm \
      pip3 download --timeout 300 -d /wheels -r /repo/requirements.txt
    echo "  完成: $(ls "$WHEELS_DIR"/*.whl 2>/dev/null | wc -l) 个 wheels"
  fi
else
  echo "  请先运行 [2/5] 下载代理池源码"
fi

# ---- 训练器 pip wheels（torch + sentence-transformers，通过 Docker 容器下载） ----
echo ""
echo "[4/5] 下载训练器 ML 依赖 wheels (torch CPU + sentence-transformers)..."
WHEELS_DIR="$PROJECT_DIR/code/training/wheels"
EXISTING=$(ls "$WHEELS_DIR"/*.whl 2>/dev/null | wc -l)

if [ "$EXISTING" -gt 5 ]; then
  echo "  wheels 已存在 ($EXISTING 个)，跳过"
else
  # 单次下载，CPU 索引为主源，PyPI 为备用——避免先拉 GPU 包再删
  docker run --rm \
    -v "$WHEELS_DIR:/wheels" \
    python:3.11-slim-bookworm \
    bash -c "\
      pip3 download --timeout 300 -d /wheels \
        torch sentence-transformers huggingface_hub einops datasets accelerate \
        --index-url https://download.pytorch.org/whl/cpu \
        --extra-index-url https://pypi.org/simple \
        --trusted-host download.pytorch.org \
        --trusted-host pypi.org --trusted-host files.pythonhosted.org \
      && for f in /wheels/torch-*.whl; do case \"\$f\" in *+cpu*) ;; *) rm -f \"\$f\" ;; esac; done \
      && rm -f /wheels/nvidia_*.whl /wheels/cuda_*.whl /wheels/cublas*.whl \
      && rm -f /wheels/triton*.whl /wheels/nccl*.whl /wheels/cuda_*.whl"
  echo "  完成: $(ls "$WHEELS_DIR"/*.whl 2>/dev/null | wc -l) 个 wheels"
fi

# ---- HuggingFace 预训练模型（通过 Docker 容器下载，存入训练镜像构建目录） ----
echo ""
echo "[5/5] 预下载 HuggingFace 预训练模型到训练镜像..."
HF_CACHE_DIR="$PROJECT_DIR/code/training/hf_cache"
SCRIPT_DIR="$PROJECT_DIR/scripts"

# 检查缓存目录是否有内容（HF_HOME 标准布局）
if [ -d "$HF_CACHE_DIR/hub" ] && [ "$(ls -A "$HF_CACHE_DIR/hub" 2>/dev/null)" ]; then
  echo "  模型缓存已存在，跳过"
else
  # 用 HF_HOME 指定缓存路径，保持标准目录结构，方便 SentenceTransformer 读取
  docker run --rm \
    -e HF_HOME=/hf_cache \
    -v "$HF_CACHE_DIR:/hf_cache" \
    -v "$SCRIPT_DIR/download-hf-models.py:/download-hf-models.py:ro" \
    python:3.11-slim-bookworm \
    bash -c "\
      pip3 install --no-cache-dir --timeout 300 huggingface_hub \
        --index-url https://pypi.org/simple \
        --trusted-host pypi.org --trusted-host files.pythonhosted.org \
      && python3 /download-hf-models.py --all"
  echo "  完成: $(du -sh "$HF_CACHE_DIR" 2>/dev/null | cut -f1) 模型文件"
fi

echo ""
echo "=========================================="
echo "  离线依赖准备完成！"
echo "  将整个项目目录拷贝到离线环境即可。"
echo "=========================================="
