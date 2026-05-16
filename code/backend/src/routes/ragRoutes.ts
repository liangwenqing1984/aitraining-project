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

// 简历结构化解析
router.post('/resume/parse', ...ragController.parseResume);

// 简历 CRUD
router.get('/resume/:id', ragController.getResume);
router.get('/resumes', ragController.listResumes);
router.put('/resume/:id', ragController.updateResume);
router.delete('/resume/:id', ragController.deleteResume);

// 简历智能筛选（硬规则 + 向量 + 加分）
router.post('/resume/screen', ragController.screenResume);

// 保存筛选结果到历史
router.post('/resume/screening/save', ragController.saveScreeningResult);

// 筛选历史记录
router.get('/resume/screening/history', ragController.getScreeningHistory);

// Excel 导出筛选结果
router.get('/resume/screening/export', ragController.exportScreeningExcel);

// Excel 导出简历库
router.get('/resumes/export', ragController.exportResumesExcel);

// 批量上传简历解析
router.post('/resume/batch-parse', ...ragController.batchParseResumes);

// 批量删除简历
router.delete('/resumes/batch', ragController.batchDeleteResumes);

export default router;
