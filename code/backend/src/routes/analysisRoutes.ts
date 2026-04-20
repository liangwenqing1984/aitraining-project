import { Router } from 'express';
import * as analysisController from '../controllers/analysisController';

const router = Router();

// 获取分析数据
router.post('/analyze', analysisController.analyze);

// 获取薪资分布
router.get('/salary/:fileId', analysisController.getSalaryDistribution);

// 获取城市分布
router.get('/city/:fileId', analysisController.getCityDistribution);

// 获取学历分布
router.get('/education/:fileId', analysisController.getEducationDistribution);

// 获取经验分布
router.get('/experience/:fileId', analysisController.getExperienceDistribution);

export default router;
