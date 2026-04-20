import { io } from '../app';
import { TaskService } from '../services/taskService';
import { db } from '../config/database';

const taskService = new TaskService();

// 连接处理
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // 订阅任务
  socket.on('task:subscribe', ({ taskId }) => {
    socket.join(`task:${taskId}`);
    console.log(`Socket ${socket.id} subscribed to task ${taskId}`);
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
