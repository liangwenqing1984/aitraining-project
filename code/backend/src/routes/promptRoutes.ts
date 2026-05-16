import { Router } from 'express';
import * as promptController from '../controllers/promptController';

const router = Router();

router.get('/', promptController.listPrompts);
router.get('/:id', promptController.getPrompt);
router.post('/', promptController.createPrompt);
router.put('/:id', promptController.updatePrompt);
router.delete('/:id', promptController.deletePrompt);
router.post('/reset-default', promptController.resetDefault);

export default router;
