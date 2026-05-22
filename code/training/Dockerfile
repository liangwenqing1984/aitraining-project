FROM python:3.11-slim-bookworm

# 训练脚本 ML 依赖（CPU 版 torch 减小镜像体积）
RUN pip3 install --no-cache-dir \
    torch sentence-transformers huggingface_hub \
    --index-url https://download.pytorch.org/whl/cpu \
    --extra-index-url https://pypi.org/simple

WORKDIR /scripts

# 保持容器运行，由后端通过 docker exec 调用
CMD ["sleep", "infinity"]
