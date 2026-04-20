import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';

// 路由
import taskRoutes from './routes/taskRoutes';
import fileRoutes from './routes/fileRoutes';
import analysisRoutes from './routes/analysisRoutes';

// 中间件
import { errorHandler } from './middleware/errorHandler';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3002', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST']
  }
});

// 中间件
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3002', 'http://127.0.0.1:3000']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件（CSV下载）
app.use('/exports', express.static(path.join(__dirname, '../data/csv')));

// 路由
app.use('/api/tasks', taskRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/analysis', analysisRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

// 错误处理
app.use(errorHandler);

export { app, httpServer, io };
