#!/usr/bin/env python3
"""
语义模型训练脚本 — 使用 sentence-transformers 对 Embedding 模型进行岗位领域微调

用法:
  python train_embedding.py \\
    --dataset data/training/dataset_xxx.jsonl \\
    --base-model nomic-ai/nomic-embed-text-v1.5 \\
    --output data/models/my_model \\
    --epochs 3 \\
    --batch-size 16 \\
    --lr 2e-5

输出:
  - 微调后的模型文件 (safetensors)
  - Modelfile (Ollama 导入用)
  - metrics.json (评估指标)

前置依赖: pip install sentence-transformers torch
"""

import argparse
import json
import os
import sys
import random
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser(description="Fine-tune embedding model on job data")
    parser.add_argument("--dataset", required=True, help="Path to training JSONL file")
    parser.add_argument("--base-model", required=True, help="HuggingFace model name or local path")
    parser.add_argument("--output", required=True, help="Output directory for trained model")
    parser.add_argument("--epochs", type=int, default=3, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=16, help="Training batch size")
    parser.add_argument("--lr", type=float, default=2e-5, help="Learning rate")
    parser.add_argument("--eval-split", type=float, default=0.2, help="Evaluation split ratio")
    parser.add_argument("--local-files-only", action="store_true", help="Use cached files only, no network")
    return parser.parse_args()


def load_training_data(dataset_path: str):
    """加载 JSONL 训练数据，返回 (anchor, positive) 对列表"""
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


def main():
    args = parse_args()

    if not os.path.exists(args.dataset):
        print(f"ERROR: Dataset file not found: {args.dataset}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading training data from {args.dataset}...")
    pairs = load_training_data(args.dataset)
    print(f"Loaded {len(pairs)} training pairs")

    if len(pairs) < 10:
        print(f"ERROR: Too few training pairs ({len(pairs)}), need at least 10", file=sys.stderr)
        sys.exit(1)

    # Train/eval split
    random.seed(42)
    random.shuffle(pairs)
    split_idx = int(len(pairs) * (1 - args.eval_split))
    train_pairs = pairs[:split_idx]
    eval_pairs = pairs[split_idx:]
    print(f"Train: {len(train_pairs)} pairs, Eval: {len(eval_pairs)} pairs")

    # 预检所有训练依赖，一次性报告缺失的包，避免训练中途中断
    required_packages = {
        "torch": "torch",
        "sentence_transformers": "sentence-transformers",
        "transformers": "transformers",
        "huggingface_hub": "huggingface-hub",
        "datasets": "datasets",
        "einops": "einops",
        "accelerate": "accelerate",
    }
    missing = []
    for module, pkg in required_packages.items():
        try:
            __import__(module)
        except ImportError:
            missing.append(pkg)
    if missing:
        print(f"ERROR: 缺少以下 Python 包，请安装后重试:", file=sys.stderr)
        print(f"  pip install {' '.join(missing)}", file=sys.stderr)
        sys.exit(1)

    from sentence_transformers import SentenceTransformer, InputExample, losses, evaluation
    from torch.utils.data import DataLoader

    print(f"Loading base model: {args.base_model}")
    hf_endpoint = os.environ.get("HF_ENDPOINT", "")
    if hf_endpoint:
        print(f"HuggingFace endpoint: {hf_endpoint}")
    print("PROGRESS:5")

    # HF 模型 ID → 本地预下载路径（离线部署用 wget 下载到 local_models/）
    HF_TO_LOCAL = {
        "nomic-ai/nomic-embed-text-v1.5": "/local_models/nomic-ai--nomic-embed-text-v1.5",
        "BAAI/bge-small-zh-v1.5": "/local_models/BAAI--bge-small-zh-v1.5",
        "BAAI/bge-base-zh-v1.5": "/local_models/BAAI--bge-base-zh-v1.5",
        "sentence-transformers/all-MiniLM-L6-v2": "/local_models/sentence-transformers--all-MiniLM-L6-v2",
    }

    model_path = args.base_model
    local_candidate = HF_TO_LOCAL.get(args.base_model, "")
    if local_candidate and os.path.isdir(local_candidate):
        print(f"Using pre-downloaded local model: {local_candidate}")
        model_path = local_candidate
    elif os.path.isdir(args.base_model):
        print(f"Using local model path: {args.base_model}")
        model_path = args.base_model
    elif not args.local_files_only:
        try:
            from huggingface_hub import snapshot_download
            print("Pre-downloading model (skipping ONNX files)...")
            model_path = snapshot_download(
                args.base_model,
                ignore_patterns=["onnx/*", "*.onnx"],
            )
            print(f"Model cached at: {model_path}")
        except Exception as e:
            print(f"WARNING: Pre-download failed ({e}), will try direct load...", file=sys.stderr)

    model_kwargs = {}
    if args.local_files_only:
        model_kwargs["local_files_only"] = True
        print("Running in offline mode (local_files_only=True)")

    try:
        model = SentenceTransformer(model_path, trust_remote_code=True, **model_kwargs)
    except OSError as e:
        error_msg = str(e)
        if "We couldn't connect to 'https://huggingface.co'" in error_msg:
            print(f"ERROR: 无法连接 HuggingFace Hub，请设置镜像环境变量:", file=sys.stderr)
            print(f"  set HF_ENDPOINT=https://hf-mirror.com", file=sys.stderr)
            print(f"或先手动下载模型到本地后使用 --base-model <本地路径>", file=sys.stderr)
            sys.exit(1)
        elif "check your connection" in error_msg.lower():
            print(f"ERROR: 网络连接失败，请检查网络或设置 HF_ENDPOINT 镜像", file=sys.stderr)
            print(f"  set HF_ENDPOINT=https://hf-mirror.com", file=sys.stderr)
            sys.exit(1)
        raise

    print("PROGRESS:15")

    # Build train examples
    train_examples = [InputExample(texts=[a, p]) for a, p in train_pairs]

    # Use MultipleNegativesRankingLoss (efficient for (anchor, positive) pairs)
    train_dataloader = DataLoader(train_examples, shuffle=True, batch_size=args.batch_size)
    train_loss = losses.MultipleNegativesRankingLoss(model)

    # Build evaluator with cosine similarity
    if len(eval_pairs) > 0:
        eval_sentences1 = [p[0] for p in eval_pairs]
        eval_sentences2 = [p[1] for p in eval_pairs]
        evaluator = evaluation.EmbeddingSimilarityEvaluator(
            eval_sentences1,
            eval_sentences2,
            scores=[1.0] * len(eval_pairs),
            name="job-eval",
        )
    else:
        evaluator = None

    print(f"Starting training: {args.epochs} epochs, batch_size={args.batch_size}, lr={args.lr}")
    print("PROGRESS:20")

    # 切到输出目录，避免 trainer 在只读 /scripts 下创建 checkpoints
    os.makedirs(args.output, exist_ok=True)
    os.chdir(args.output)

    warmup_steps = int(len(train_dataloader) * args.epochs * 0.1)

    model.fit(
        train_objectives=[(train_dataloader, train_loss)],
        epochs=args.epochs,
        warmup_steps=warmup_steps,
        evaluator=evaluator,
        evaluation_steps=0,  # 由 EvaluatorCallback 负责评估，避免 Trainer 内置 eval 需要 eval_dataset
        output_path=args.output,
        optimizer_params={"lr": args.lr},
        show_progress_bar=True,
    )

    print("PROGRESS:85")

    # Evaluate
    metrics = {}
    if evaluator is not None:
        try:
            eval_result = evaluator(model, output_path=args.output)
            # sentence-transformers 3.x 返回 dict，2.x 返回 float
            if isinstance(eval_result, dict):
                # 取 pearson_cosine 或 job-eval_pearson_cosine，回退到第一个可用值
                pearson_key = next((k for k in eval_result if 'pearson' in k.lower()), None)
                metrics["eval_pearson"] = float(eval_result[pearson_key]) if pearson_key else 0.0
                # 同时保存完整评估结果
                metrics["eval_details"] = {k: float(v) if v is not None else 0.0 for k, v in eval_result.items()}
                print(f"Eval results: {metrics['eval_details']}")
            else:
                metrics["eval_pearson"] = float(eval_result) if eval_result is not None else 0.0
                print(f"Eval Pearson correlation: {metrics['eval_pearson']:.4f}")
        except Exception as e:
            print(f"WARNING: Evaluation failed ({e}), eval set may be too small or embeddings collapsed", file=sys.stderr)
            metrics["eval_pearson"] = 0.0

    # Also evaluate ranking accuracy on eval set
    if len(eval_pairs) > 0:
        correct_top1 = 0
        for anchor, positive in eval_pairs[:min(100, len(eval_pairs))]:
            all_texts = [positive] + [p[1] for p in random.sample(eval_pairs, min(10, len(eval_pairs)))]
            embeddings = model.encode([anchor] + all_texts)
            anchor_emb = embeddings[0]
            similarities = [(i, float(anchor_emb @ embeddings[i + 1])) for i in range(len(all_texts))]
            similarities.sort(key=lambda x: x[1], reverse=True)
            if similarities[0][0] == 0:
                correct_top1 += 1
        metrics["accuracy_top1"] = round(correct_top1 / min(100, len(eval_pairs)), 4)
        print(f"Top-1 Accuracy: {metrics['accuracy_top1']}")

    print("PROGRESS:90")

    # Save model (already saved by model.fit to output_path, but save again explicitly)
    model.save(args.output)
    print(f"Model saved to {args.output}")

    # 拷贝 trust_remote_code 依赖的 .py 文件到输出目录（评估/部署时需要）
    import shutil
    py_copied = 0
    if model_path != args.output:
        for fn in os.listdir(model_path):
            if fn.endswith('.py'):
                src = os.path.join(model_path, fn)
                dst = os.path.join(args.output, fn)
                if not os.path.exists(dst):
                    shutil.copy2(src, dst)
                    py_copied += 1
    if py_copied > 0:
        print(f"Copied {py_copied} trust_remote_code module files")

    # Generate Ollama Modelfile
    # 将 HuggingFace 模型 ID 映射为 Ollama 可识别的模型名称
    HF_TO_OLLAMA = {
        "nomic-ai/nomic-embed-text-v1.5": "nomic-embed-text:latest",
        "nomic-ai/nomic-embed-text-v1": "nomic-embed-text:latest",
        "BAAI/bge-base-zh-v1.5": "bge-base-zh:latest",
        "BAAI/bge-small-zh-v1.5": "bge-small-zh:latest",
        "sentence-transformers/all-MiniLM-L6-v2": "all-minilm:latest",
        "sentence-transformers/all-mpnet-base-v2": "all-minilm:latest",
    }
    ollama_base = HF_TO_OLLAMA.get(args.base_model)
    from_line = f"FROM {ollama_base}" if ollama_base else f"# FROM {args.base_model}  (请手动替换为 Ollama 模型名)"

    modelfile_content = f"""
{from_line}
# Domain fine-tuned on job descriptions ({len(train_pairs)} pairs)
# Model saved to: {args.output}
"""
    modelfile_path = os.path.join(args.output, "Modelfile")
    with open(modelfile_path, "w", encoding="utf-8") as f:
        f.write(modelfile_content.strip())
    print(f"Modelfile written to {modelfile_path}")

    # Save metrics
    metrics["train_pairs"] = len(train_pairs)
    metrics["eval_pairs"] = len(eval_pairs)
    metrics["base_model"] = args.base_model
    metrics_path = os.path.join(args.output, "metrics.json")
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2, ensure_ascii=False)

    print("PROGRESS:100")
    print(f"Training complete! Model: {args.output}")
    print(f"To deploy in Ollama: ollama create {Path(args.output).name} -f {modelfile_path}")


if __name__ == "__main__":
    main()
