import { Router } from 'express';
import * as trainingController from '../controllers/trainingController';

const router = Router();

// 训练数据集
router.post('/dataset/build', trainingController.buildDataset);
router.get('/dataset/list', trainingController.listDatasetsHandler);
router.get('/dataset/:id/preview', trainingController.previewDatasetHandler);

// 模型管理（具体路由放前面，避免被 /:id 误匹配）
router.get('/models', trainingController.listModels);
router.post('/models/evaluate', trainingController.evaluateModel);
router.delete('/models/:name', trainingController.deleteModel);
router.post('/models/deploy', trainingController.deployModel);

// 训练任务（/:id 放最后）
router.post('/start', trainingController.startTraining);
router.get('/status/:id', trainingController.getTrainingStatus);
router.get('/list', trainingController.listTrainingJobs);
router.post('/:id/stop', trainingController.stopTraining);
router.delete('/:id', trainingController.deleteTrainingJob);

export default router;
