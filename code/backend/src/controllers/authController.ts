import { Request, Response } from 'express';
import authService from '../services/authService';

/**
 * OAuth2认证控制器
 * 处理授权回调、Token交换、用户信息等接口
 */

/**
 * 生成授权URL
 * GET /api/auth/authorize-url
 */
export function getAuthorizeUrl(req: Request, res: Response) {
  try {
    const { state } = req.query;
    const authorizeUrl = authService.generateAuthorizeUrl(state as string);

    res.json({
      success: true,
      data: {
        authorizeUrl
      }
    });
  } catch (error: any) {
    console.error('[Auth] 生成授权URL失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '生成授权URL失败'
    });
  }
}

/**
 * OAuth2回调处理 - Auth服务回调到此接口
 * GET /api/auth/callback?code=xxx&state=xxx
 * 接收code并交换Token，然后重定向到前端页面
 */
export async function handleCallback(req: Request, res: Response) {
  try {
    const { code, state, error, error_description } = req.query;

    // 检查是否有授权错误
    if (error) {
      console.error('[Auth] 授权失败:', error, error_description);
      // 重定向到前端登录页，带上错误信息
      return res.redirect(`http://localhost:3000/login?error=${encodeURIComponent(error as string)}&error_description=${encodeURIComponent(error_description as string)}`);
    }

    if (!code) {
      console.error('[Auth] 缺少授权码');
      return res.redirect('http://localhost:3000/login?error=missing_code&error_description=缺少授权码');
    }

    console.log('[Auth] 收到Token交换请求', { code: code.toString().substring(0, 10) + '...', state });

    // 验证state参数（防CSRF）
    // 注意：生产环境应该从session或redis中验证state

    // 使用code换取Token
    const tokenResult = await authService.exchangeCodeForToken(code as string);

    if (!tokenResult.success || !tokenResult.data) {
      console.error('[Auth] Token交换失败:', tokenResult.error);
      return res.redirect(`http://localhost:3000/login?error=token_exchange_failed&error_description=${encodeURIComponent(tokenResult.error || 'Token交换失败')}`);
    }

    // 获取用户信息
    const userInfoResult = await authService.getUserInfo(tokenResult.data.accessToken);

    if (!userInfoResult.success) {
      console.warn('[Auth] 获取用户信息失败，但Token有效');
    }

    console.log('[Auth] Token交换成功');

    // 将Token保存到Cookie
    authService.setTokenToCookie(res, tokenResult.data);

    // 将用户信息也保存到Cookie（便于前端显示）
    if (userInfoResult.data) {
      res.cookie('oauth_user_info', JSON.stringify(userInfoResult.data), {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: tokenResult.data.expiresIn * 1000
      });
    }

    // 重定向到前端首页
    res.redirect('http://localhost:3000/');
  } catch (error: any) {
    console.error('[Auth] 回调处理异常:', error);
    res.redirect(`http://localhost:3000/login?error=unknown_error&error_description=${encodeURIComponent(error.message || '未知错误')}`);
  }
}

/**
 * 刷新Token
 * POST /api/auth/refresh-token
 */
export async function refreshToken(req: Request, res: Response) {
  try {
    // 从Cookie中获取refreshToken
    const refreshTokenValue = req.cookies?.oauth_refresh_token;

    if (!refreshTokenValue) {
      return res.status(400).json({
        success: false,
        message: '缺少refreshToken'
      });
    }

    console.log('[Auth] 开始刷新Token');

    const result = await authService.refreshToken(refreshTokenValue);

    if (!result.success) {
      // 清除所有Cookie
      authService.clearTokenCookie(res);
      
      return res.status(401).json({
        success: false,
        message: result.error || 'Token刷新失败'
      });
    }

    // 更新Cookie中的Token
    authService.setTokenToCookie(res, result.data);

    res.json({
      success: true,
      data: result.data
    });
  } catch (error: any) {
    console.error('[Auth] Token刷新失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Token刷新失败'
    });
  }
}

/**
 * 获取当前用户信息
 * GET /api/auth/user-info
 */
export async function getUserInfo(req: Request, res: Response) {
  try {
    // 从Cookie中获取accessToken
    const accessToken = req.cookies?.oauth_access_token;

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: '未登录'
      });
    }

    console.log('[Auth] 获取用户信息');

    const result = await authService.getUserInfo(accessToken);

    if (!result.success) {
      return res.status(401).json({
        success: false,
        message: result.error || '获取用户信息失败'
      });
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error: any) {
    console.error('[Auth] 获取用户信息失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取用户信息失败'
    });
  }
}

/**
 * 验证Token有效性
 * POST /api/auth/validate-token
 */
export async function validateToken(req: Request, res: Response) {
  try {
    // 从Cookie中获取accessToken
    const accessToken = req.cookies?.oauth_access_token;

    if (!accessToken) {
      return res.json({
        success: true,
        data: {
          valid: false
        }
      });
    }

    console.log('[Auth] 验证Token有效性');

    const isValid = await authService.validateToken(accessToken);

    res.json({
      success: true,
      data: {
        valid: isValid
      }
    });
  } catch (error: any) {
    console.error('[Auth] Token验证失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Token验证失败'
    });
  }
}

/**
 * 登出 - 按照文档要求实现
 * POST /api/auth/logout
 * 1. 从Cookie获取access_token
 * 2. 调用Auth服务获取logoutTicket
 * 3. 返回ticket给前端，由前端完成跳转
 */
export async function logout(req: Request, res: Response) {
  try {
    // 从Cookie中获取accessToken
    const accessToken = req.cookies?.oauth_access_token;

    if (!accessToken) {
      // 即使没有token，也清除Cookie
      authService.clearTokenCookie(res);
      
      return res.json({
        success: true,
        message: '已登出',
        data: {
          logoutTicket: null
        }
      });
    }

    console.log('[Auth] 开始登出流程');

    // 调用Auth服务获取logoutTicket
    const ticketResult = await authService.getLogoutTicket(accessToken);

    if (!ticketResult.success) {
      console.warn('[Auth] 获取logoutTicket失败，但仍清除本地Cookie');
      authService.clearTokenCookie(res);
      
      return res.json({
        success: true,
        message: '登出完成',
        data: {
          logoutTicket: null
        }
      });
    }

    // 清除Cookie
    authService.clearTokenCookie(res);

    console.log('[Auth] 登出成功，logoutTicket:', ticketResult.data);

    res.json({
      success: true,
      message: '登出成功',
      data: {
        logoutTicket: ticketResult.data
      }
    });
  } catch (error: any) {
    console.error('[Auth] 登出失败:', error);
    
    // 即使出错也要清除Cookie
    authService.clearTokenCookie(res);
    
    res.status(500).json({
      success: false,
      message: error.message || '登出失败'
    });
  }
}
