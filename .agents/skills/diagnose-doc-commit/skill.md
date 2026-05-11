---
name: diagnose-doc-commit
description: Write diagnostic documentation for completed changes, commit to local repo, push to remote, and merge to main branch. Use this skill when the user says "提交代码", "提交到远程", "合并到主分支", or after completing a significant feature/fix that should be documented and merged.
---

# 诊断文档编写 + 代码提交 + 合并主分支

当用户完成一组功能或修复后，要求编写诊断文档并提交代码时使用此技能。

## 流程

按以下顺序执行，每步完成后再进入下一步：

### Step 1: 检查当前状态

```bash
git status
git diff --stat
git log --oneline -5
```

确认当前分支名、有哪些修改文件、最近的提交风格。

### Step 2: 编写诊断文档

在 `docs/diagnostics/` 目录下创建编号文档，文件命名格式：`{编号}_{中文标题}.md`

文档模板：

```markdown
# {标题}

## 概述
简要说明本次变更涉及的核心模块和功能。

## 一、{模块1名称}

### 需求/问题
描述需求背景或要解决的问题。

### 实现/修复
说明具体改了什么，列出关键代码片段或文件。

## 二、{模块2名称}
...

## 验收清单
- [x] {检查项}
```

要求：
- 编号递增：查看 `docs/diagnostics/` 目录下最大的编号，使用下一个
- 涵盖所有核心变更，按模块分节
- 涉及的关键文件用反引号标注文件名
- 包含验收清单

### Step 3: 暂存文件

```bash
git add <所有修改的文件> <诊断文档>
```

注意：
- 不要暂存 `.env`、`credentials.json` 等敏感文件
- 不要暂存 `dump.rdb`、`node_modules` 等生成文件
- 只暂存本次变更明确相关的文件

### Step 4: 提交

```bash
git commit -m "$(cat <<'EOF'
<type>: <中文简短描述>

- <变更点1>
- <变更点2>
- <变更点3>
EOF
)"
```

提交信息规范：
- type 使用 `feat`、`fix`、`refactor`、`docs`、`chore`
- 标题用中文，简洁说明本次变更
- 正文用列表列出每项变更

### Step 5: 推送

```bash
git push origin <当前分支名>
```

### Step 6: 合并到 main

```bash
git checkout main
git merge <当前分支名> --no-edit
git push origin main
git checkout <当前分支名>
```

如果是 Fast-forward 合并则直接完成；如果有冲突则报告用户处理。

合并完成后切回原分支。

### Step 7: 确认结果

```bash
git log --oneline -3
```

报告用户：
- 诊断文档路径
- commit hash 和消息
- 远程推送结果
- 主分支合并结果
