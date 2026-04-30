# stop→恢复后重复采集修复（jobIndex 硬编码归零）

## 涉及提交

| 提交 | 修复内容 |
|------|---------|
| `61ae0b4` | 停止时保存正确的 jobIndex 而非硬编码 0，防止恢复后重复采集 |

---

## 问题

任务 `b17b989f-18a6-42a8-9bc1-27114eda8858` 的第 4 个组合（关键词×城市）仅解析到 13 个职位，但前端显示该组合采集了 30+ 条。恢复后大量职位被重复采集。

日志显示：
```
[ZhilianCrawler] 💾 中止断点已保存: 组合4, 第5页, 职位1
```

第一次停止时当前组合已处理到第 13 个职位，但 `_resumeState.jobIndex` 被保存为 `0`（而非 `13`）。恢复时从 `jobIndex=0` 开始重新抓取，导致前 13 条职位重复入库。

---

## 根因

`_resumeState` 是 stop→恢复机制的**唯一断点数据**，存储在 PostgreSQL 的 `task_config.config` JSONB 字段中。断点格式：

```json
{
  "_resumeState": {
    "combinationIndex": 4,
    "currentPage": 5,
    "jobIndex": 0   // ← 始终为 0，bug！
  }
}
```

3 个中止断点保存位置全部硬编码 `jobIndex: 0`：

```typescript
// 位置1：外层 catch 块
abortConfig._resumeState = {
  combinationIndex: currentCombination,
  currentPage: currentPage,
  jobIndex: 0  // ← 硬编码
};

// 位置2：组合级 abort handler
// 位置3：组合正常退出路径
// （均为 jobIndex: 0）
```

变量 `currentJobIndex` 在 for 循环中持续递增，但保存时未使用。

---

## 修复

3 个保存点全部改为使用实际变量 `currentJobIndex`：

```typescript
// 修复后（位置1）
abortConfig._resumeState = {
  combinationIndex: currentCombination,
  currentPage: currentPage,
  jobIndex: currentJobIndex  // 实际值，如 13
};

// 日志也同步修正
this.log('info', `💾 中止断点已保存: 组合${currentCombination}, 第${currentPage}页, 职位${currentJobIndex + 1}`);
```

---

## 修改位置

| 修改 | 文件 | 行 |
|------|------|-----|
| 外层 catch 中止断点 | `zhilian.ts` | 1627 |
| 组合级 abort 断点 | `zhilian.ts` | 1765 |
| 组合正常退出路径 | `zhilian.ts` | 1798 |

---

## 效果

| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| 组合第 4 页第 13 个职位停止 | 恢复后从 jobIndex=0 重抓 | 恢复后从 jobIndex=12 继续 |
| 重复入库 | 前 13 条重复（30+ 条记录） | 无重复 |
| 任务总记录数 | 虚高 | 准确 |
