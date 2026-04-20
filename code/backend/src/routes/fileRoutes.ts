import { Router } from 'express';
import * as fileController from '../controllers/fileController';

const router = Router();

// 获取文件列表
router.get('/', fileController.getFiles);

// 🔧 新增：根据taskId获取文件信息（具体路由优先）
router.get('/task/:taskId', fileController.getFileByTaskId);

// 🔧 新增：分析CSV文件数据（具体路由优先）
router.get('/:id/analyze', fileController.analyzeCsvFile);

// 下载文件（具体路由优先）
router.get('/:id/download', fileController.downloadFile);

// 预览文件（具体路由优先）
router.get('/:id/preview', fileController.previewFile);

// 获取文件详情（通用路由放最后）
router.get('/:id', fileController.getFile);

// 删除文件
router.delete('/:id', fileController.deleteFile);

// 批量删除
router.post('/batch-delete', fileController.batchDelete);

export default router;
