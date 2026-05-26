#!/usr/bin/env python3
"""
预下载 HuggingFace 模型到本地缓存，供离线训练使用

用法:
  python3 scripts/download-hf-models.py --model nomic-ai/nomic-embed-text-v1.5
  python3 scripts/download-hf-models.py --model BAAI/bge-small-zh-v1.5
  python3 scripts/download-hf-models.py --all   # 下载全部常用模型

离线训练时需设置环境变量:
  export HF_HUB_OFFLINE=1
  export TRANSFORMERS_OFFLINE=1
或使用 --local-files-only 参数
"""

import argparse
import os
import sys

# 常用 Embedding 模型列表
COMMON_MODELS = [
    "nomic-ai/nomic-embed-text-v1.5",
    "BAAI/bge-small-zh-v1.5",
    "BAAI/bge-base-zh-v1.5",
    "sentence-transformers/all-MiniLM-L6-v2",
]


def cache_transformers_modules(model_name: str):
    """触发 transformers 缓存 config + trust_remote_code 动态模块文件"""
    try:
        from transformers import AutoConfig
        print(f"  缓存 transformers 模块: {model_name}")
        AutoConfig.from_pretrained(model_name, trust_remote_code=True)
        print(f"  ✓ 动态模块已缓存")
    except ImportError:
        print(f"  ⚠ transformers 未安装，跳过模块缓存（离线训练前请确保模块已缓存）")
    except Exception as e:
        print(f"  ⚠ 模块缓存失败: {e}")


def download_model(model_name: str, cache_dir: str = None):
    """下载模型及其依赖文件到本地缓存"""
    from huggingface_hub import snapshot_download

    print(f"正在下载: {model_name}")
    try:
        # 优先使用 hf-mirror 镜像加速
        os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")

        local_path = snapshot_download(
            model_name,
            ignore_patterns=["onnx/*", "*.onnx", "flax_model*", "rust_model*", "tf_model*"],
            cache_dir=cache_dir,
        )
        print(f"   → {local_path}")

        # 缓存 transformers 动态模块（trust_remote_code 需要）
        cache_transformers_modules(model_name)

        # 同时使用 sentence-transformers 验证下载完整性
        try:
            from sentence_transformers import SentenceTransformer
            SentenceTransformer(local_path, trust_remote_code=True, local_files_only=True)
            print(f"   ✓ 模型验证通过")
        except ImportError:
            print(f"   ⚠ sentence-transformers 未安装，跳过验证")
        except Exception as e:
            print(f"   ⚠ 验证失败: {e}")

    except Exception as e:
        print(f"   ✗ 下载失败: {e}")
        return False

    return True


def main():
    parser = argparse.ArgumentParser(description="预下载 HuggingFace 模型")
    parser.add_argument("--model", help="模型名称")
    parser.add_argument("--all", action="store_true", help="下载所有常用模型")
    parser.add_argument("--cache-dir", help="自定义缓存目录")
    args = parser.parse_args()

    if args.all:
        models = COMMON_MODELS
    elif args.model:
        models = [args.model]
    else:
        # 默认下载最常用的一个
        models = [COMMON_MODELS[0]]
        print(f"未指定模型，默认下载: {models[0]}")
        print(f"使用 --all 下载全部常用模型")

    for model in models:
        download_model(model, args.cache_dir)
        print()

    print("下载完成。离线训练时请设置环境变量:")
    print("  export HF_HUB_OFFLINE=1")
    print("  export TRANSFORMERS_OFFLINE=1")


if __name__ == "__main__":
    main()
