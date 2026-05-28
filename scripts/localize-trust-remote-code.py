#!/usr/bin/env python3
"""
本地化 trust_remote_code 模型——下载外部依赖的 Python 模块，修改 auto_map 为本地引用

用法:
  python3 scripts/localize-trust-remote-code.py --dir <模型目录>
  python3 scripts/localize-trust-remote-code.py --all  # 处理 local_models/ 下所有模型
"""

import argparse
import json
import os
import sys
import urllib.request


def download_file(url: str, output_path: str) -> bool:
    """用 urllib 下载文件（stdlib，无需额外依赖）"""
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


def fix_auto_map(model_dir: str) -> bool:
    """修改 config.json 的 auto_map，将外部 repo 引用改为本地文件引用"""
    config_path = os.path.join(model_dir, "config.json")
    if not os.path.exists(config_path):
        return False

    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    auto_map = config.get("auto_map", {})
    if not auto_map:
        return False

    repo_files = {}  # repo_id -> set(filenames)
    for value in auto_map.values():
        if "--" in str(value):
            repo_id, filename = str(value).split("--", 1)
            repo_files.setdefault(repo_id, set()).add(filename)

    if not repo_files:
        return False

    print(f"  需本地化 {len(repo_files)} 个外部依赖: {list(repo_files.keys())}")

    endpoint = os.environ.get("HF_ENDPOINT", "https://hf-mirror.com")

    for repo_id, filenames in repo_files.items():
        for fname in filenames:
            py_file = fname if fname.endswith(".py") else fname + ".py"
            url = f"{endpoint}/{repo_id}/resolve/main/{py_file}"
            output = os.path.join(model_dir, py_file)
            print(f"  [下载] {repo_id}/{py_file} ...")
            if download_file(url, output):
                print(f"    -> {os.path.getsize(output)/1024:.1f} KB")
            else:
                print(f"    跳过")

    # 修改 auto_map: "repo--file" → "file"
    for key, value in auto_map.items():
        if "--" in str(value):
            _, filename = str(value).split("--", 1)
            auto_map[key] = filename
            print(f"  auto_map: {key} = {filename}")

    config["auto_map"] = auto_map
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    print(f"  ✓ config.json 已本地化")
    return True


def main():
    parser = argparse.ArgumentParser(description="本地化 trust_remote_code 模型依赖")
    parser.add_argument("--dir", help="模型目录路径")
    parser.add_argument("--all", action="store_true", help="处理 local_models/ 下所有模型")
    args = parser.parse_args()

    if args.all:
        local_dir = "code/training/local_models"
        if not os.path.isdir(local_dir):
            print(f"目录不存在: {local_dir}")
            sys.exit(1)
        models = [
            os.path.join(local_dir, d)
            for d in sorted(os.listdir(local_dir))
            if os.path.isdir(os.path.join(local_dir, d))
        ]
    elif args.dir:
        models = [args.dir]
    else:
        print("用法: --dir <模型目录> 或 --all")
        sys.exit(1)

    count = 0
    for model_dir in models:
        name = os.path.basename(model_dir)
        print(f"\n===== {name} =====")
        if fix_auto_map(model_dir):
            count += 1

    print(f"\n本地化完成: {count} 个模型已处理")
    if count == 0:
        print("(无需要本地化的模型)")


if __name__ == "__main__":
    main()
