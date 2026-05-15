#!/usr/bin/env python3
"""
模型评估脚本 — 对已训练模型单独运行评估，生成/更新 metrics.json

用法:
  python evaluate_model.py \\
    --model data/models/my_model \\
    --dataset data/training/dataset_xxx.jsonl \\
    [--eval-split 0.2]
"""

import argparse
import json
import os
import sys
import random

# 设置 HuggingFace 镜像，与训练脚本保持一致
os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
os.environ.setdefault("HF_HUB_ENABLE_HF_XET", "0")
# 禁止在线下载，强制使用本地文件（已训练模型自带 config/code）
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_HUB_OFFLINE"] = "1"


def parse_args():
    parser = argparse.ArgumentParser(description="Evaluate a trained embedding model")
    parser.add_argument("--model", required=True, help="Path to trained model directory")
    parser.add_argument("--dataset", required=True, help="Path to training JSONL file")
    parser.add_argument("--eval-split", type=float, default=0.2, help="Evaluation split ratio")
    return parser.parse_args()


def load_training_data(dataset_path: str):
    pairs = []
    with open(dataset_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                anchor = obj.get("anchor", "").strip()
                positive = obj.get("positive", "").strip()
                if anchor and positive:
                    pairs.append((anchor, positive))
            except json.JSONDecodeError:
                continue
    return pairs


def prepare_model_config(model_dir: str):
    """修复模型的 config.json，使 auto_map 指向本地文件而非 HF 远程模块。

    已训练模型的 config.json 中 auto_map 引用了原始 nomic-ai/nomic-bert-2048
    动态模块，与本地 configuration_hf_nomic_bert.py 的类不匹配，导致 ValueError。
    此函数将 modeling 文件从 HF 缓存复制到模型目录并改写 auto_map 为本地引用。
    """
    config_path = os.path.join(model_dir, "config.json")
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    auto_map = config.get("auto_map", {})
    if not auto_map:
        return  # 无需处理

    # 检查是否有指向远程模块的条目 (格式: repo_id--file.Class)
    has_remote = any("--" in v for v in auto_map.values())
    if not has_remote:
        return  # 已经都是本地引用

    # 查找 HF 缓存中的 modeling_hf_nomic_bert.py
    import glob as _glob
    cache_base = os.path.expanduser("~/.cache/huggingface/modules/transformers_modules")
    modeling_file = "modeling_hf_nomic_bert.py"
    candidates = _glob.glob(os.path.join(cache_base, "**", modeling_file), recursive=True)

    if candidates:
        src = candidates[0]
        dst = os.path.join(model_dir, modeling_file)
        if not os.path.exists(dst):
            import shutil
            shutil.copy2(src, dst)
            print(f"Copied {modeling_file} from cache to model directory")

    # 改写 auto_map：去掉 "repo_id--" 前缀，指向本地文件
    new_auto_map = {}
    for key, value in auto_map.items():
        if "--" in value:
            _, cls_path = value.split("--", 1)
            new_auto_map[key] = cls_path
        else:
            new_auto_map[key] = value

    config["auto_map"] = new_auto_map
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
    print(f"Fixed auto_map in config.json: {new_auto_map}")


def main():
    args = parse_args()

    if not os.path.isdir(args.model):
        print(f"ERROR: Model directory not found: {args.model}", file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(args.dataset):
        print(f"ERROR: Dataset file not found: {args.dataset}", file=sys.stderr)
        sys.exit(1)

    # 修复可能存在的 remote auto_map 引用问题
    prepare_model_config(args.model)

    print(f"Loading training data from {args.dataset}...")
    pairs = load_training_data(args.dataset)
    print(f"Loaded {len(pairs)} pairs")

    if len(pairs) < 10:
        print(f"ERROR: Too few pairs ({len(pairs)}), need at least 10", file=sys.stderr)
        sys.exit(1)

    # Train/eval split
    random.seed(42)
    random.shuffle(pairs)
    split_idx = int(len(pairs) * (1 - args.eval_split))
    eval_pairs = pairs[split_idx:]
    print(f"Eval set: {len(eval_pairs)} pairs")

    if len(eval_pairs) == 0:
        print("ERROR: No eval pairs available", file=sys.stderr)
        sys.exit(1)

    try:
        from sentence_transformers import SentenceTransformer, evaluation
    except ImportError as e:
        print("ERROR: sentence-transformers not installed. Run: pip install sentence-transformers torch", file=sys.stderr)
        sys.exit(1)

    print(f"Loading model from {args.model}...")
    model = SentenceTransformer(args.model, trust_remote_code=True, local_files_only=True)

    metrics = {}

    # Pearson (cosine similarity) evaluation
    print("Running embedding similarity evaluation...")
    eval_sentences1 = [p[0] for p in eval_pairs]
    eval_sentences2 = [p[1] for p in eval_pairs]
    evaluator = evaluation.EmbeddingSimilarityEvaluator(
        eval_sentences1,
        eval_sentences2,
        scores=[1.0] * len(eval_pairs),
        name="job-eval",
    )

    try:
        eval_result = evaluator(model, output_path=args.model)
        if isinstance(eval_result, dict):
            pearson_key = next((k for k in eval_result if 'pearson' in k.lower()), None)
            metrics["eval_pearson"] = float(eval_result[pearson_key]) if pearson_key else 0.0
            metrics["eval_details"] = {k: float(v) if v is not None else 0.0 for k, v in eval_result.items()}
            print(f"Eval results: {metrics['eval_details']}")
        else:
            metrics["eval_pearson"] = float(eval_result) if eval_result is not None else 0.0
            print(f"Eval Pearson correlation: {metrics['eval_pearson']:.4f}")
    except Exception as e:
        print(f"WARNING: Evaluation failed ({e})", file=sys.stderr)
        metrics["eval_pearson"] = 0.0

    # Ranking accuracy (Top-1)
    print("Running top-1 accuracy evaluation...")
    correct_top1 = 0
    sample_size = min(100, len(eval_pairs))
    for anchor, positive in eval_pairs[:sample_size]:
        all_texts = [positive] + [p[1] for p in random.sample(eval_pairs, min(10, len(eval_pairs)))]
        embeddings = model.encode([anchor] + all_texts)
        anchor_emb = embeddings[0]
        similarities = [(i, float(anchor_emb @ embeddings[i + 1])) for i in range(len(all_texts))]
        similarities.sort(key=lambda x: x[1], reverse=True)
        if similarities[0][0] == 0:
            correct_top1 += 1

    metrics["accuracy_top1"] = round(correct_top1 / sample_size, 4)
    print(f"Top-1 Accuracy: {metrics['accuracy_top1']}")

    # Write metrics.json (convert NaN to null for valid JSON)
    import math
    def nan_to_none(obj):
        if isinstance(obj, dict):
            return {k: nan_to_none(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [nan_to_none(v) for v in obj]
        if isinstance(obj, float) and math.isnan(obj):
            return None
        return obj

    metrics_path = os.path.join(args.model, "metrics.json")
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(nan_to_none(metrics), f, indent=2)
    print(f"Metrics written to {metrics_path}")


if __name__ == "__main__":
    main()
