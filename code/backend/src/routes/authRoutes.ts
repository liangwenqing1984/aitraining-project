import { Router } from 'express';
import * as authController from '../controllers/authController';

const router = Router();

/**
 * OAuth2认证路由
 */

// 生成授权URL
router.get('/authorize-url', authController.getAuthorizeUrl);

// OAuth2回调处理（接收code并交换Token）
router.get('/callback', authController.handleCallback);

// 刷新Token
router.post('/refresh-token', authController.refreshToken);

// 获取当前用户信息
router.get('/user-info', authController.getUserInfo);

// 验证Token有效性
router.post('/validate-token', authController.validateToken);

// 登出
router.post('/logout', authController.logout);

export default router;
