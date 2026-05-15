# DeepSeek 推理模型简历解析 token 耗尽修复

## 现象

简历结构化解析时报错：

```
[CloudProvider.deepseek] 推理模型思考占满了token限制(4096)，content为空。
reasoning_content长度: 8733。需要更大的maxTokens。

[RAG] parseResume error: REASONING_EXHAUSTED: ...
```

上传简历文件后 LLM 解析失败，无法提取结构化字段。

---

## 根因分析

### token 预算共用机制

DeepSeek V4 Pro 是推理模型（reasoning model），API 响应中包含两个字段：

| 字段 | 说明 |
|------|------|
| `reasoning_content` | 模型的思考/推理过程 |
| `content` | 最终回复内容 |

两者**共用** `max_tokens` 参数限制。若思考过程消耗完所有 token，`content` 将为空。

### 调用链路

```
parseResumeStructure()                           [resumeParser.ts:68]
  → llmService.callLLM(system, user, options)    [llm/index.ts:98]
    → CloudProvider.call(modelName, ...)          [cloud.ts:18]
      → body.max_tokens = options.maxTokens ?? 4096  ← 默认 4096
```

`resumeParser.ts` 调用时未传 `maxTokens`，走默认值 4096。

### token 消耗估算

简历解析任务的特点：
- **系统提示词长**：18 个字段的提取规则，约 1500 tokens
- **用户输入长**：简历文本截断至 4000 字符，约 2000-3000 tokens
- **输出复杂**：JSON 含嵌套数组（projects/certifications/languages），约 1500-3000 tokens
- **推理开销大**：多字段综合提取需大量推理，reasoning_content 实际达 8733 字符

总需求 ≈ 1500 + 3000 + 3000 + 4000(推理) ≈ 11500 tokens，远超 4096。

### 已有防御逻辑

[cloud.ts:81-84](code/backend/src/services/llm/providers/cloud.ts#L81-L84) 已正确检测此情况：

```typescript
if (!content.trim() && message.reasoning_content) {
    throw new Error(`REASONING_EXHAUSTED: 推理模型思考占满了token限制...`);
}
```

该检查防止了返回空 content 导致后续 JSON.parse 崩溃，但未从根本上解决 token 不足问题。

---

## 修复

[resumeParser.ts:71](code/backend/src/services/llm/resumeParser.ts#L71) — 调用 LLM 时显式传入 `maxTokens`：

```diff
- { taskType: 'resume-parse', responseFormat: 'json', temperature: 0.1 }
+ { taskType: 'resume-parse', responseFormat: 'json', temperature: 0.1, maxTokens: 16384 }
```

将 token 上限从默认 4096 提升至 16384：
- 推理思考预留 ~10000 tokens
- JSON 输出预留 ~6000 tokens
- 足够覆盖 18 字段完整提取

---

## 设计启示

对于所有使用推理模型 + 复杂输出的场景，需评估 `maxTokens` 是否充足：

| 任务类型 | 推理复杂度 | 输出规模 | 建议 maxTokens |
|----------|-----------|----------|---------------|
| enrichment（增强） | 低-中 | 中 | 4096-8192 |
| resume-parse（简历解析） | 高 | 大 | 16384 |
| query（自然语言查询） | 中 | 小-中 | 4096-8192 |
| anti-crawl（反爬） | 低 | 小 | 4096 |

通用原则：`maxTokens` 足够容纳 `reasoning_content + content`，且为 content 留出至少 1.5 倍预估输出长度。

---

## 验收
- [x] 上传简历文件 → LLM 返回完整 18 字段 JSON → 数据库写入成功
- [x] DeepSeek V4 Pro 推理模型不再报 REASONING_EXHAUSTED
- [x] TypeScript 编译 0 错误
