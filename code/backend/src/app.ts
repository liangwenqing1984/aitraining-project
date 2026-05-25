import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';

// 路由
import taskRoutes from './routes/taskRoutes';
import fileRoutes from './routes/fileRoutes';
import analysisRoutes from './routes/analysisRoutes';
import authRoutes from './routes/authRoutes';
import llmRoutes from './routes/llmRoutes';
import ragRoutes from './routes/ragRoutes';
import systemRoutes from './routes/systemRoutes';
import chatRoutes from './routes/chatRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import regionRoutes from './routes/regionRoutes';
import trainingRoutes from './routes/trainingRoutes';
import internalJobRoutes from './routes/internalJobRoutes';
import promptRoutes from './routes/promptRoutes';

// 中间件
import { errorHandler } from './middleware/errorHandler';

// CORS 允许的源（通过环境变量 CORS_ORIGIN 配置，逗号分隔多个）
const corsOrigin = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3002,http://127.0.0.1:3000')
  .split(',')
  .map(s => s.trim());

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// 中间件
app.use(cors({
  origin: corsOrigin,
  credentials: true
}));
// 🔧 优化：增加请求体大小限制（默认100kb -> 1mb），支持大量关键词和企业名称
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser()); // 添加cookie-parser中间件

// 静态文件（CSV下载）
app.use('/exports', express.static(path.join(__dirname, '../data/csv')));

// 路由
app.use('/api/tasks', taskRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/llm', llmRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/region', regionRoutes);
app.use('/api/internal-jobs', internalJobRoutes);
app.use('/api/prompts', promptRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api', systemRoutes);
app.use('/api', chatRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

// 错误处理
app.use(errorHandler);

export { app, httpServer, io };
