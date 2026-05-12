import { httpServer } from './app';
import { initDatabase } from './config/database';
import { llmService } from './services/llm';
import './socket';

const PORT = process.env.PORT || 3004;

// 初始化数据库并启动服务器
async function startServer() {
  try {
    await initDatabase();
    await llmService.initialize();

    // 运行种子数据（首次启动时自动初始化系统管理数据）
    const { runSeed } = await import('./services/seedService');
    await runSeed();

    // 启动服务器
    httpServer.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`API: http://localhost:${PORT}/api`);
      console.log(`WebSocket: ws://localhost:${PORT}`);

      // 异步索引帮助文档（不阻塞服务启动）
      setTimeout(async () => {
        try {
          const { getDocIndexStats, indexAllDocs } = await import('./services/docIndexService');
          const stats = await getDocIndexStats();
          if (stats.sectionCount === 0) {
            console.log('[Index] 文档尚未索引，开始自动索引...');
            await indexAllDocs();
          } else {
            console.log(`[Index] 文档已索引: ${stats.sectionCount} 章节, ${stats.chunkCount} 片段`);
          }
        } catch (e: any) {
          console.warn('[Index] 文档自动索引失败（不影响正常使用）:', e.message);
        }
      }, 3000);
    });
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
}

startServer();