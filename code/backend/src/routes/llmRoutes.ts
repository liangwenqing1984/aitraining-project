import { Router } from 'express';
import * as llmController from '../controllers/llmController';

const router = Router();

// LLM 配置管理
router.get('/config', llmController.listConfigs);
router.post('/config', llmController.saveConfig);
router.delete('/config/:id', llmController.deleteConfig);

// 健康检查
router.get('/health', llmController.healthCheck);

// 测试调用
router.post('/test', llmController.testCall);

// 数据增强
router.post('/enrich/:taskId', llmController.enrichTask);
router.get('/enrich/:taskId/status', llmController.getEnrichStatus);
router.get('/enrich/:taskId/result', llmController.getEnrichResults);

// 市场洞察
router.post('/insights/:fileId', llmController.generateInsight);
router.get('/insights/:fileId/history', llmController.getInsightHistory);
router.get('/insights/report/:reportId', llmController.getInsightReport);

// 自然语言查询
router.post('/query', llmController.queryData);
router.get('/query/history', llmController.getQueryHist);
router.delete('/query/:id', llmController.deleteQueryRecord);

// AI 反爬
router.post('/anti-crawl/classify', llmController.classifyPageAction);
router.post('/anti-crawl/selectors', llmController.suggestSelectorsAction);
router.post('/anti-crawl/action', llmController.recommendActionAction);

export default router;
