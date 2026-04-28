import { Router } from 'express';
import * as ragController from '../controllers/ragController';

const router = Router();

// 启动向量化索引（异步，立即返回）
router.post('/index/:taskId', ragController.indexTask);

// 同步向量化索引（等待完成返回结果）
router.post('/index/:taskId/sync', ragController.indexTaskSync);

// 语义相似搜索
router.post('/search', ragController.search);

// 向量化统计
router.get('/stats', ragController.stats);

export default router;
