import { Router } from 'express';
import * as ragController from '../controllers/ragController';

const router = Router();

// 启动向量化索引（异步，立即返回）
router.post('/index/:taskId', ragController.indexTask);

// 同步向量化索引（等待完成返回结果）
router.post('/index/:taskId/sync', ragController.indexTaskSync);

// 语义相似搜索
router.post('/search', ragController.search);

// 删除指定任务的向量索引
router.delete('/index/:taskId', ragController.deleteIndex);

// 向量化统计
router.get('/stats', ragController.stats);

// 职位向量列表（管理页用）
router.get('/index/records', ragController.listJobEmbeddings);

// 简历文本匹配职位
router.post('/resume/match', ragController.matchResume);

// 上传简历文件 + 匹配职位
router.post('/resume/upload', ...ragController.uploadAndMatch);

export default router;
