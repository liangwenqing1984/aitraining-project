#!/usr/bin/env python3
"""
本地化 trust_remote_code 模型——确保动态 .py 模块文件存在于本地模型目录

支持两种 auto_map 格式:
  1. repo_id--module_file     → 从外部仓库下载，转换 auto_map 为本地引用
  2. module_file.ClassName    → 已是本地引用，检查文件是否存在，不存在则从源仓库下载

用法:
  python3 scripts/localize-trust-remote-code.py --dir <模型目录>
  python3 scripts/localize-trust-remote-code.py --all --output /local_models
"""

import argparse
import json
import os
import sys
import urllib.request


KNOWN_DEPENDENCIES = {
    # nomic-embed-text-v1.5 的 Python 模块在 nomic-bert-2048 仓库
    "nomic-ai--nomic-embed-text-v1.5": {
        "configuration_hf_nomic_bert": "nomic-ai/nomic-bert-2048",
        "modeling_hf_nomic_bert": "nomic-ai/nomic-bert-2048",
    },
}


def download_file(url: str, output_path: str) -> bool:
    if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
        return True
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(data)
        return True
    except Exception as e:
        print(f"    [下载失败] {e}")
        return False


def fix_auto_map(model_dir: str, model_name: str = "") -> bool:
    config_path = os.path.join(model_dir, "config.json")
    if not os.path.exists(config_path):
        return False

    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    auto_map = config.get("auto_map", {})
    if not auto_map:
        return False

    endpoint = os.environ.get("HF_ENDPOINT", "https://hf-mirror.com")
    deps = KNOWN_DEPENDENCIES.get(model_name, {})
    modified = False

    for key, value in list(auto_map.items()):
        if "--" in str(value):
            # 格式: repo_id--module_file → 下载后改为本地引用
            repo_id, module_name = str(value).split("--", 1)
            py_file = module_name if module_name.endswith(".py") else module_name + ".py"
            url = f"{endpoint}/{repo_id}/resolve/main/{py_file}"
            output = os.path.join(model_dir, py_file)
            print(f"  [下载] {py_file} (来自 {repo_id})")
            if download_file(url, output):
                print(f"    -> {os.path.getsize(output)/1024:.1f} KB")
            auto_map[key] = module_name  # 本地引用，不加 .py
            modified = True
        else:
            # 格式: module_file.ClassName → 已是本地引用，检查文件是否存在
            module_name = str(value).split(".")[0]
            py_file = module_name if module_name.endswith(".py") else module_name + ".py"
            file_path = os.path.join(model_dir, py_file)
            if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
                continue  # 文件已存在，跳过

            # 从已知依赖仓库下载
            src_repo = deps.get(module_name, "")
            if not src_repo:
                # 回退: 尝试从自身 repo 下载
                src_repo = model_name.replace("--", "/") if model_name else ""
            if not src_repo:
                print(f"  [警告] {py_file} 不存在且无法确定来源仓库")
                continue

            url = f"{endpoint}/{src_repo}/resolve/main/{py_file}"
            output = os.path.join(model_dir, py_file)
            print(f"  [下载] {py_file} (来自 {src_repo})")
            if download_file(url, output):
                print(f"    -> {os.path.getsize(output)/1024:.1f} KB")
                modified = True

    if modified:
        config["auto_map"] = auto_map
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        print(f"  ✓ auto_map 已更新")

    return modified


def main():
    parser = argparse.ArgumentParser(description="本地化 trust_remote_code 模型依赖")
    parser.add_argument("--dir", help="模型目录路径")
    parser.add_argument("--output", default="code/training/local_models", help="local_models 根目录")
    parser.add_argument("--all", action="store_true", help="处理输出目录下所有模型")
    args = parser.parse_args()

    if args.all:
        if not os.path.isdir(args.output):
            print(f"目录不存在: {args.output}")
            sys.exit(1)
        models = [
            (d, os.path.join(args.output, d))
            for d in sorted(os.listdir(args.output))
            if os.path.isdir(os.path.join(args.output, d))
        ]
    elif args.dir:
        models = [(os.path.basename(args.dir), args.dir)]
    else:
        print("用法: --dir <模型目录> 或 --all [--output <目录>]")
        sys.exit(1)

    count = 0
    for name, model_dir in models:
        print(f"\n===== {name} =====")
        if fix_auto_map(model_dir, model_name=name):
            count += 1

    print(f"\n本地化完成: {count} 个模型已处理")


if __name__ == "__main__":
    main()
