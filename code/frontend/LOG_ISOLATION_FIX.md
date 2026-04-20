# 实时日志隔离问题修复说明

## 🐛 问题描述

**现象**: 当同时运行多个爬取任务时,所有任务的详情页面都显示的是最新任务的日志,而不是各自任务的独立日志。

**影响范围**: 
- 打开任务A的详情页 → 显示任务A的日志 ✅
- 启动任务B → 任务A的详情页也开始显示任务B的日志 ❌
- 所有打开的详情页面都显示最新任务的日志 ❌

---

## 🔍 根本原因分析

### 1. 全局共享的logs数组

在 [`crawler.ts`](d:\AICODEING\aitraining\code\frontend\src\stores\crawler.ts) 中,`logs` 是一个全局的响应式数组:

```typescript
// ❌ 旧代码 - 所有任务共用一个日志数组
const logs = ref<Array<{ time: string; level: string; message: string }>>([])
```

### 2. Socket监听未过滤taskId

在 `connectSocket()` 函数中,`task:log` 事件直接调用 `addLog`,没有检查是否是当前订阅的任务:

```typescript
// ❌ 旧代码 - 无条件添加日志
socket.value.on('task:log', (data: any) => {
  addLog(data.level || 'info', data.message)  // 没有检查taskId
})
```

### 3. 订阅机制不完整

虽然调用了 `subscribeTask(taskId)`,但前端接收消息时没有根据 `taskId` 进行过滤,导致所有任务的日志都添加到同一个数组。

---

## ✅ 解决方案

采用 **Map存储 + taskId路由** 的组合方案:

### 核心改进

#### 1. 使用Map为每个任务维护独立日志

```typescript
// ✅ 新代码 - 每个任务有独立的日志数组
const taskLogs = ref<Map<string, Array<{ time: string; level: string; message: string }>>>(new Map())

// 兼容旧代码: 提供计算属性返回当前任务的日志
const logs = computed(() => {
  if (!currentTask.value?.id) return []
  return taskLogs.value.get(currentTask.value.id) || []
})
```

#### 2. Socket监听时根据taskId路由日志

```typescript
// ✅ 新代码 - 根据taskId路由到对应的任务日志
socket.value.on('task:log', (data: any) => {
  // data应该包含: { taskId, level, message }
  if (data.taskId) {
    addLogToTask(data.taskId, data.level || 'info', data.message)
  } else {
    // 兼容旧格式: 如果没有taskId,添加到当前任务
    if (currentTask.value?.id) {
      addLogToTask(currentTask.value.id, data.level || 'info', data.message)
    }
  }
})
```

#### 3. 新增专用方法管理任务日志

```typescript
// 为指定任务添加日志
function addLogToTask(taskId: string, level: string, message: string) {
  if (!taskLogs.value.has(taskId)) {
    taskLogs.value.set(taskId, [])
  }
  
  const taskLogList = taskLogs.value.get(taskId)!
  taskLogList.push({
    time: new Date().toLocaleTimeString(),
    level,
    message
  })
  
  // 限制每个任务的日志数量(最多500条)
  if (taskLogList.length > 500) {
    taskLogList.shift()
  }
}

// 清空指定任务的日志
function clearTaskLogs(taskId: string) {
  taskLogs.value.set(taskId, [])
}

// 切换当前任务时,确保日志数组存在
function setCurrentTask(task: Task | null) {
  currentTask.value = task
  if (task?.id && !taskLogs.value.has(task.id)) {
    taskLogs.value.set(task.id, [])
  }
}
```

#### 4. 所有Socket事件都增加了taskId检查

```typescript
// ✅ 状态更新事件
socket.value.on('task:status', (data: any) => {
  const task = tasks.value.find(t => t.id === data.taskId)
  if (task) {
    task.status = data.status
    // 只在当前任务是此任务时才添加日志
    if (currentTask.value?.id === data.taskId && data.message) {
      addLogToTask(data.taskId, 'info', data.message)
    }
  }
  // ...
})

// ✅ 完成事件
socket.value.on('task:completed', (data: any) => {
  updateTaskCompleted(data.taskId, data)
  // 只在当前任务是此任务时才添加日志
  if (currentTask.value?.id === data.taskId) {
    addLogToTask(data.taskId, 'success', `任务完成，共采集 ${data.totalRecords} 条数据`)
  }
})

// ✅ 错误事件
socket.value.on('task:error', (data: any) => {
  updateTaskError(data.taskId, data.error)
  // 只在当前任务是此任务时才添加日志
  if (currentTask.value?.id === data.taskId) {
    addLogToTask(data.taskId, 'error', data.error)
  }
})
```

---

## 📋 修改文件清单

| 文件 | 修改内容 | 影响范围 |
|------|---------|---------|
| [`frontend/src/stores/crawler.ts`](d:\AICODEING\aitraining\code\frontend\src\stores\crawler.ts) | 1. 将`logs`从`ref`改为`computed`<br>2. 新增`taskLogs` Map<br>3. 新增`addLogToTask`方法<br>4. 所有Socket监听增加taskId过滤<br>5. 修正字段名为驼峰命名 | 全局Store,影响所有使用日志的组件 |

---

## 🎯 技术要点

### 1. Pinia Store中的响应式Map

```typescript
// 使用ref包装Map,确保响应式
const taskLogs = ref<Map<string, Array<...>>>(new Map())

// 访问时需要 .value
taskLogs.value.get(taskId)
taskLogs.value.set(taskId, [])
```

### 2. Computed属性的惰性求值

```typescript
// logs现在是计算属性,每次访问都会重新计算
const logs = computed(() => {
  if (!currentTask.value?.id) return []
  return taskLogs.value.get(currentTask.value.id) || []
})

// 组件中使用 crawlerStore.logs 会自动获取当前任务的日志
```

### 3. 向后兼容性

```typescript
// 保留旧的addLog方法,但标记为废弃
function addLog(level: string, message: string) {
  console.warn('[Store] addLog已废弃,请使用addLogToTask')
  if (currentTask.value?.id) {
    addLogToTask(currentTask.value.id, level, message)
  }
}

// 组件中原有的 crawlerStore.addLog 调用仍然有效
```

---

## 🧪 测试验证

### 测试场景1: 单任务运行
1. 创建并启动任务A
2. 打开任务A的详情页
3. 观察日志是否只显示任务A的信息 ✅

### 测试场景2: 多任务并行
1. 创建并启动任务A
2. 创建并启动任务B
3. 打开任务A的详情页 → 应只显示任务A的日志 ✅
4. 打开任务B的详情页 → 应只显示任务B的日志 ✅
5. 在两个页面之间切换 → 各自显示正确的日志 ✅

### 测试场景3: 任务完成后重启
1. 完成任务A
2. 重新启动任务A
3. 日志应该清空并重新开始记录 ✅

### 测试场景4: 删除任务
1. 删除任务A
2. 确认任务A的日志已从Map中清理 ✅

---

## 🚀 性能优化

### 1. 日志数量限制

```typescript
// 每个任务最多保留500条日志
if (taskLogList.length > 500) {
  taskLogList.shift()  // 移除最旧的日志
}
```

### 2. 内存管理

```typescript
// 删除任务时清理日志
async function deleteTask(taskId: string) {
  // ...
  taskLogs.value.delete(taskId)
}
```

### 3. 按需加载

```typescript
// 只有在切换到某个任务时才初始化其日志数组
function setCurrentTask(task: Task | null) {
  currentTask.value = task
  if (task?.id && !taskLogs.value.has(task.id)) {
    taskLogs.value.set(task.id, [])
  }
}
```

---

## ⚠️ 注意事项

### 1. 后端需要正确发送taskId

确保后端在所有 `io.to(...).emit('task:log', ...)` 调用中都包含了 `taskId`:

```typescript
// ✅ 正确的后端代码
io.to(`task:${taskId}`).emit('task:log', {
  taskId,  // 必须包含
  level: 'info',
  message: '日志内容'
})
```

### 2. 前端组件无需修改

由于 `logs` 现在是计算属性,原有组件中的 `crawlerStore.logs` 用法保持不变,无需修改。

### 3. TypeScript类型安全

所有新方法都有完整的类型定义,TypeScript会提供智能提示和类型检查。

---

## 📊 效果对比

### 修复前
```
任务A详情页: [任务A日志, 任务B日志, 任务C日志] ❌
任务B详情页: [任务A日志, 任务B日志, 任务C日志] ❌
任务C详情页: [任务A日志, 任务B日志, 任务C日志] ❌
```

### 修复后
```
任务A详情页: [任务A日志] ✅
任务B详情页: [任务B日志] ✅
任务C详情页: [任务C日志] ✅
```

---

## 🔗 相关文档

- [Pinia官方文档 - State](https://pinia.vuejs.org/core-concepts/state.html)
- [Vue 3 Composition API - Computed](https://vuejs.org/guide/essentials/computed.html)
- [Socket.IO Rooms and Namespaces](https://socket.io/docs/v4/rooms/)

---

## 📝 总结

本次修复通过以下三个关键改进解决了日志隔离问题:

1. **数据结构优化**: 从单一数组改为Map存储,每个任务独立管理日志
2. **事件路由精确化**: Socket监听时根据taskId精确路由日志
3. **生命周期管理**: 任务创建、删除时自动初始化和清理日志

这些改进不仅解决了当前的问题,还为未来支持更多并发任务打下了良好的基础。
