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

export default router;
