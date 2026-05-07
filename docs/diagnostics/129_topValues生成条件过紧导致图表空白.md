# 智能分析 topValues 生成条件过紧导致图表空白

## 问题

智联任务 `13abde3e-050a-4cf2-b9cd-0a37949ff525`（智联-多职位-单城市，511条数据）智能分析时城市分布、职位分布、企业性质三个图表无数据。

## 根因

`fileController.ts:312` 的 topValues 生成条件:

```typescript
if (uniqueValues.size <= 200 && uniqueValues.size > 1)
```

该任务数据:
| 字段 | 唯一值数 | 违反条件 | 影响 |
|------|---------|---------|------|
| `工作城市` | 1 | `> 1` | 单城市搜索，唯一值不够 |
| `职位名称` | 460 | `≤ 200` | 多职位搜索，唯一值太多 |
| `公司性质` | 1 | `> 1` | 511条中仅1条有值 |

三个字段全部被过滤，前端显示误导性错误"CSV中缺少XX字段"。

## 修复

### 后端 `fileController.ts`

```typescript
// 修改前
if (uniqueValues.size <= 200 && uniqueValues.size > 1)

// 修改后
if (uniqueValues.size <= 1000 && uniqueValues.size > 0)
```

- 上限 200 → 1000：覆盖职位名称等高频次字段
- 下限 >1 → >0：覆盖单城市搜索等单值场景

### 前端 `analysis/Index.vue`

- 新增 `diagnosticMessages` 计算属性，动态生成准确的缺失原因
- 替换硬编码的固定错误消息（不再总是说"CSV中缺少字段"）

## 涉及文件

- `code/backend/src/controllers/fileController.ts` — 阈值调整
- `code/frontend/src/views/analysis/Index.vue` — 诊断信息动态化

## 验证

重启 `start-dev.bat`，对单城市任务做智能分析，所有7个图表应有数据（或准确说明为何无数据）。
