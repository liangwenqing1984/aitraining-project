#!/usr/bin/env python3
"""
用 wget 下载 HF 模型文件到本地目录，绕开 huggingface_hub 的大文件下载机制

用法:
  python3 scripts/download-models-wget.py --all
  python3 scripts/download-models-wget.py --model nomic-ai/nomic-embed-text-v1.5
  python3 scripts/download-models-wget.py --model BAAI/bge-small-zh-v1.5 --output ./local_models

训练时用: --base-model ./local_models/nomic-embed-text-v1.5
"""

import argparse
import json
import os
import subprocess
import sys
import urllib.request
import urllib.error

COMMON_MODELS = [
    "nomic-ai/nomic-embed-text-v1.5",
    "BAAI/bge-small-zh-v1.5",
    "BAAI/bge-base-zh-v1.5",
    "sentence-transformers/all-MiniLM-L6-v2",
]

# 需要跳过的文件/目录（节省下载量，不影响 SentenceTransformer 加载）
SKIP_PATTERNS = [
    "onnx/", ".onnx", "flax_model", "rust_model", "tf_model",
    "model.onnx", "model.onnx_data",
]


def list_repo_files(model_id: str, endpoint: str) -> list[str]:
    """通过 HF API 获取模型文件列表（仅 HTTP GET，不触发下载机制）"""
    url = f"{endpoint}/api/models/{model_id}?expand[]=siblings&securityStatus=true"
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"  ✗ API 请求失败: {e}")
        return []

    files = []
    for sib in data.get("siblings", []):
        fname = sib.get("rfilename", "")
        if fname:
            files.append(fname)
    return files


def should_skip(filename: str) -> bool:
    for pattern in SKIP_PATTERNS:
        if pattern in filename:
            return True
    return False


def download_file(url: str, output_path: str) -> bool:
    """用 wget 下载单个文件"""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    # 已存在且非空则跳过
    if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
        size_mb = os.path.getsize(output_path) / (1024 * 1024)
        print(f"    [跳过] 已存在 ({size_mb:.1f} MB)")
        return True

    result = subprocess.run(
        ["wget", "-q", "--show-progress", "--timeout=120", "-O", output_path, url],
        stdout=sys.stdout, stderr=subprocess.STDOUT
    )
    return result.returncode == 0


def download_model(model_id: str, output_base: str, endpoint: str) -> bool:
    """下载单个模型的所有文件"""
    local_name = model_id.replace("/", "--")
    target_dir = os.path.join(output_base, local_name)
    os.makedirs(target_dir, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"模型: {model_id}")
    print(f"目标: {target_dir}")
    print(f"{'='*60}")

    # 1. 获取文件列表
    print("  获取文件列表...")
    files = list_repo_files(model_id, endpoint)
    if not files:
        print(f"  ✗ 无法获取文件列表，跳过")
        return False

    # 过滤
    to_download = [f for f in files if not should_skip(f)]
    print(f"  共 {len(to_download)} 个文件需要下载")

    # 2. 逐个用 wget 下载
    success = 0
    failed = 0
    for fname in to_download:
        url = f"{endpoint}/{model_id}/resolve/main/{fname}"
        output = os.path.join(target_dir, fname)
        size_hint = ""
        print(f"  [{fname}]{size_hint}")
        if download_file(url, output):
            success += 1
        else:
            failed += 1
            print(f"    ✗ 下载失败")

    # 3. 验证
    config_ok = os.path.exists(os.path.join(target_dir, "config.json"))
    has_weights = any(
        os.path.exists(os.path.join(target_dir, f)) and os.path.getsize(os.path.join(target_dir, f)) > 0
        for f in files if f.endswith(".safetensors") or f.endswith(".bin")
    )
    total_size = 0
    for root, _, filenames in os.walk(target_dir):
        for fn in filenames:
            fp = os.path.join(root, fn)
            if os.path.exists(fp):
                total_size += os.path.getsize(fp)
    size_mb = total_size / (1024 * 1024)

    if config_ok and has_weights:
        print(f"  ✓ 完成 ({size_mb:.0f} MB, {success} 成功, {failed} 失败)")
        return True
    else:
        missing = []
        if not config_ok:
            missing.append("config.json")
        if not has_weights:
            missing.append("权重文件")
        print(f"  ⚠ 缺少: {', '.join(missing)} ({size_mb:.0f} MB)")
        return False


def main():
    parser = argparse.ArgumentParser(description="wget 直连下载 HF 模型")
    parser.add_argument("--model", help="单个模型 ID")
    parser.add_argument("--all", action="store_true", help="下载所有常用模型")
    parser.add_argument("--output", default="code/training/local_models", help="输出目录 (默认: code/training/local_models)")
    parser.add_argument("--endpoint", default="https://huggingface.co", help="HF 端点 (默认: https://huggingface.co)")
    args = parser.parse_args()

    if args.all:
        models = COMMON_MODELS
    elif args.model:
        models = [args.model]
    else:
        print("请指定 --model 或 --all")
        sys.exit(1)

    print(f"下载源: {args.endpoint}")
    print(f"输出目录: {args.output}")
    print(f"模型数量: {len(models)}")

    for model in models:
        download_model(model, args.output, args.endpoint)

    print(f"\n{'='*60}")
    print(f"全部完成！训练时使用:")
    for model in models:
        local_name = model.replace("/", "--")
        print(f"  --base-model {args.output}/{local_name}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
