import { Router } from 'express';
import * as taskController from '../controllers/taskController';

const router = Router();

// 创建任务
router.post('/', taskController.createTask);

// 获取任务列表
router.get('/', taskController.getTasks);

// 获取任务详情
router.get('/:id', taskController.getTask);

// 启动任务
router.post('/:id/start', taskController.startTask);

// 停止任务
router.post('/:id/stop', taskController.stopTask);

// 暂停任务
router.post('/:id/pause', taskController.pauseTask);

// 恢复任务
router.post('/:id/resume', taskController.resumeTask);

// 删除任务
router.delete('/:id', taskController.deleteTask);

// 获取省市列表
router.get('/regions/list', taskController.getRegions);

export default router;