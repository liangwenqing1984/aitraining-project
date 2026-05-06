import { io } from '../app';
import { TaskService } from '../services/taskService';
import { db } from '../config/database';
import { getEnrichmentStatus } from '../services/llm/enrichment';

const taskService = new TaskService();

// 连接处理
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // 订阅任务
  socket.on('task:subscribe', async ({ taskId }) => {
    socket.join(`task:${taskId}`);
    console.log(`Socket ${socket.id} subscribed to task ${taskId}`);

    // 如果有正在运行的增强任务，立即推送当前进度（解决页面刷新后进度丢失）
    try {
      const status = await getEnrichmentStatus(taskId);
      if (status.runningProgress) {
        socket.emit('enrichment:progress', status.runningProgress);
        console.log(`[Socket] 重放增强进度给 ${socket.id}: ${taskId} (${status.runningProgress.completed}/${status.runningProgress.total})`);
      }
    } catch { /* ignore */ }
  });

  // 取消订阅
  socket.on('task:unsubscribe', ({ taskId }) => {
    socket.leave(`task:${taskId}`);
    console.log(`Socket ${socket.id} unsubscribed from task ${taskId}`);
  });

  // 停止任务
  socket.on('task:stop', ({ taskId }) => {
    taskService.stopTask(taskId);
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

export { io, taskService };
