import { Router } from 'express';
import * as regionController from '../controllers/regionController';

const router = Router();

router.get('/stats', regionController.getStats);

export default router;
