# WebSocket 重连后自动重新订阅运行中任务

## 问题

WebSocket 断线重连后，之前订阅的任务进度推送（`task:progress`）全部丢失。用户看到的运行中任务状态不再更新，必须刷新页面才能恢复。

## 根因

Socket.IO 的自动重连仅恢复连接，不会恢复应用层的 `task:subscribe` 订阅。服务器端维护的是房间（room）关系，断线后客户端离开房间，重连后需重新加入。

## 解决方案

### 1. 追踪需要重新订阅的任务

```typescript
function resubscribeRunningTasks() {
  if (!socket.value || !socket.value.connected) return;

  const runningTaskIds = tasks.value
    .filter(t => t.status === 'running' || t.status === 'paused')
    .map(t => t.id);

  if (runningTaskIds.length > 0) {
    console.log(`[WebSocket] 🔄 重新订阅 ${runningTaskIds.length} 个运行中的任务`);
    runningTaskIds.forEach(taskId => {
      socket.value?.emit('task:subscribe', { taskId });
    });
  }
}
```

### 2. connect 事件中自动调用

```typescript
socket.value.on('connect', () => {
  isConnected.value = true;
  reconnectAttempts.value = 0;
  isManualDisconnect.value = false;
  
  // 🔧 关键：连接成功后重新订阅所有运行中的任务
  resubscribeRunningTasks();
});
```

### 3. 重连状态管理

```typescript
const reconnectAttempts = ref(0);
const maxReconnectAttempts = 5;
const isManualDisconnect = ref(false);  // 标记用户主动断开

// Socket.IO 自动重连配置
io('http://localhost:3004', {
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 0  // 无限重试，由前端手动控制上限
});
```

### 4. 重连失败处理

```typescript
socket.value.on('reconnect_error', (error) => {
  if (reconnectAttempts.value >= maxReconnectAttempts) {
    ElMessage.error({
      message: '重连失败次数过多，请检查网络连接或刷新页面',
      duration: 5000
    });
  }
});

socket.value.on('reconnect_failed', () => {
  ElMessage.error({
    message: '无法连接到服务器，请检查后端服务是否正常运行',
    duration: 0,  // 不自动关闭
    showClose: true
  });
});
```

## 修改位置

| 修改 | 文件 | 位置 |
|------|------|------|
| resubscribeRunningTasks 函数 | crawler.ts | ~50-63 |
| connect 事件中调用 | crawler.ts | ~85-86 |
| 重连事件监听 | crawler.ts | ~107-136 |
| 手动断开标记 | crawler.ts | ~217-223 |

## 效果

- 断线重连后自动恢复所有运行中任务的进度推送
- 用户无需手动刷新页面
- 区分手动断开和意外断开，手动断开不触发重连提示
