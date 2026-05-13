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
    parser.add_argument("--base-model", required=True, help="HuggingFace model name")
    parser.add_argument("--output", required=True, help="Output directory for trained model")
    parser.add_argument("--epochs", type=int, default=3, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=16, help="Training batch size")
    parser.add_argument("--lr", type=float, default=2e-5, help="Learning rate")
    parser.add_argument("--eval-split", type=float, default=0.2, help="Evaluation split ratio")
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

    # Import sentence-transformers (lazy import — only needed when training)
    try:
        from sentence_transformers import SentenceTransformer, InputExample, losses, evaluation
        from torch.utils.data import DataLoader
    except ImportError as e:
        print(f"ERROR: sentence-transformers not installed. Run: pip install sentence-transformers torch", file=sys.stderr)
        sys.exit(1)

    print(f"Loading base model: {args.base_model}")
    print("PROGRESS:5")

    model = SentenceTransformer(args.base_model)
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
            name="job-eval",
        )
    else:
        evaluator = None

    print(f"Starting training: {args.epochs} epochs, batch_size={args.batch_size}, lr={args.lr}")
    print("PROGRESS:20")

    warmup_steps = int(len(train_dataloader) * args.epochs * 0.1)

    model.fit(
        train_objectives=[(train_dataloader, train_loss)],
        epochs=args.epochs,
        warmup_steps=warmup_steps,
        evaluator=evaluator,
        evaluation_steps=max(1, len(train_dataloader) // 2),
        output_path=args.output,
        optimizer_params={"lr": args.lr},
        show_progress_bar=False,
    )

    print("PROGRESS:85")

    # Evaluate
    metrics = {}
    if evaluator is not None:
        eval_result = evaluator(model, output_path=args.output)
        metrics["eval_pearson"] = float(eval_result) if eval_result is not None else 0.0
        print(f"Eval Pearson correlation: {metrics['eval_pearson']:.4f}")

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

    # Generate Ollama Modelfile
    modelfile_content = f"""
FROM {args.base_model}
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
