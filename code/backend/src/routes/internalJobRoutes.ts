import { Router } from 'express';
import * as controller from '../controllers/internalJobController';

const router = Router();

router.get('/', controller.listJobs);
router.get('/:id', controller.getJob);
router.post('/', controller.createJob);
router.put('/:id', controller.updateJob);
router.delete('/:id', controller.deleteJob);

export default router;
