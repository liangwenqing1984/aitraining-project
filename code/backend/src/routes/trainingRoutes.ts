import { Router } from 'express';
import * as trainingController from '../controllers/trainingController';

const router = Router();

// 训练数据集
router.post('/dataset/build', trainingController.buildDataset);
router.get('/dataset/list', trainingController.listDatasetsHandler);
router.get('/dataset/:id/preview', trainingController.previewDatasetHandler);

// 训练任务
router.post('/start', trainingController.startTraining);
router.get('/status/:id', trainingController.getTrainingStatus);
router.get('/list', trainingController.listTrainingJobs);
router.delete('/:id', trainingController.deleteTrainingJob);

// 模型管理
router.get('/models', trainingController.listModels);
router.post('/models/deploy', trainingController.deployModel);

export default router;
