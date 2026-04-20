import { httpServer } from './app';
import { initDatabase } from './config/database';
import './socket';

const PORT = process.env.PORT || 3004;

// 初始化数据库并启动服务器
async function startServer() {
  try {
    await initDatabase();
    
    // 启动服务器
    httpServer.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`API: http://localhost:${PORT}/api`);
      console.log(`WebSocket: ws://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
}

startServer();