import { Router } from 'express';
import * as chatController from '../controllers/chatController';
import * as docController from '../controllers/docController';

const router = Router();

// 聊天
router.post('/chat/send', chatController.sendMessage);
router.get('/chat/sessions', chatController.listSessions);
router.get('/chat/sessions/:id', chatController.getSession);
router.delete('/chat/sessions/:id', chatController.deleteSession);

// 文档索引
router.post('/docs/index', docController.indexDocs);
router.get('/docs/index/status', docController.getIndexStatus);

export default router;
