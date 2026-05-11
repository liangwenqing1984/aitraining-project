import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController';

const router = Router();

router.get('/overview', dashboardController.overview);

// AI 全量洞察报告
router.post('/insights', dashboardController.generateInsight);
router.get('/insights/history', dashboardController.getInsightHistory);
router.get('/insights/report/:reportId', dashboardController.getInsightReportById);
router.get('/insights/report/:reportId/pdf', dashboardController.downloadReportPdf);

export default router;
