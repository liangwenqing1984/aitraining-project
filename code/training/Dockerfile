FROM python:3.11-slim-bookworm

WORKDIR /scripts

# 自适应：有本地 wheels 就离线安装，否则在线安装
COPY wheels/ /wheels/

RUN if ls /wheels/*.whl >/dev/null 2>&1; then \
      echo "离线安装 ML 依赖..."; \
      pip3 install --no-cache-dir --no-index --find-links=/wheels/ \
        torch sentence-transformers huggingface_hub \
      && rm -rf /wheels; \
    else \
      echo "在线安装 ML 依赖..."; \
      pip3 install --no-cache-dir \
        torch sentence-transformers huggingface_hub \
        --index-url https://download.pytorch.org/whl/cpu \
        --extra-index-url https://pypi.org/simple; \
    fi

# 保持容器运行，由后端通过 docker exec 调用
CMD ["sleep", "infinity"]
