import axios from 'axios';
import { Response } from 'express';

/**
 * OAuth2认证服务
 * 负责与Auth服务交互,处理授权码模式和Token管理
 */

// Auth服务配置
const AUTH_CONFIG = {
  // 授权地址
  authorizeUrl: 'http://leaf-auth-server.dev.jinxin.cloud/auth2/oauth2/authorize',
  // Token交换地址
  tokenUrl: 'http://leaf-auth-server.dev.jinxin.cloud/auth2/oauth2/token',
  // 用户信息接口
  userInfoUrl: 'http://leaf-auth-server.dev.jinxin.cloud/auth2/api/v2/user/getLoginUser',
  // 登出ticket接口
  logoutTicketUrl: 'http://leaf-auth-server.dev.jinxin.cloud/auth2/api/v2/login/logoutTicket',
  // 应用凭证 - 统一使用 aitraining
  clientId: 'aitraining',      // 授权和Token交换都使用 aitraining
  clientSecret: '29b9635df0164eb890d99a58ffa7f8f2',
  // 回调地址(开发环境) - 必须是后端API路由
  redirectUri: process.env.AUTH_REDIRECT_URI || 'http://localhost:3000/api/auth/callback',
  // 授权范围
  scope: 'openid all'
};

/**
 * 生成授权URL
 * @param state - 防重放状态参数
 * @returns 授权页面URL
 */
export function generateAuthorizeUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: AUTH_CONFIG.clientId,
    response_type: 'code',
    scope: AUTH_CONFIG.scope,
    redirect_uri: AUTH_CONFIG.redirectUri
  });

  if (state) {
    params.append('state', state);
  }

  return `${AUTH_CONFIG.authorizeUrl}?${params.toString()}`;
}

/**
 * 使用授权码换取Token
 * @param code - 授权码
 * @returns Token信息
 */
export async function exchangeCodeForToken(code: string) {
  try {
    console.log('[OAuth2] 开始交换Token...', { code: code.substring(0, 10) + '...' });

    // 使用multipart/form-data格式提交
    const formData = new FormData();
    formData.append('grant_type', 'authorization_code');
    formData.append('code', code);
    formData.append('redirect_uri', AUTH_CONFIG.redirectUri);
    formData.append('client_id', AUTH_CONFIG.clientId);
    formData.append('client_secret', AUTH_CONFIG.clientSecret);

    const response = await axios.post(AUTH_CONFIG.tokenUrl, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    console.log('[OAuth2] Token交换成功', {
      tokenType: response.data.token_type,
      expiresIn: response.data.expires_in,
      scope: response.data.scope
    });

    return {
      success: true,
      data: {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        tokenType: response.data.token_type,
        expiresIn: response.data.expires_in,
        scope: response.data.scope,
        idToken: response.data.id_token
      }
    };
  } catch (error: any) {
    console.error('[OAuth2] Token交换失败:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error_description || error.message || 'Token交换失败'
    };
  }
}

/**
 * 刷新Token
 * @param refreshToken - 刷新令牌
 * @returns 新的Token信息
 */
export async function refreshToken(refreshToken: string) {
  try {
    console.log('[OAuth2] 开始刷新Token...');

    const formData = new FormData();
    formData.append('grant_type', 'refresh_token');
    formData.append('refresh_token', refreshToken);
    formData.append('client_id', AUTH_CONFIG.clientId);
    formData.append('client_secret', AUTH_CONFIG.clientSecret);

    const response = await axios.post(AUTH_CONFIG.tokenUrl, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    console.log('[OAuth2] Token刷新成功');

    return {
      success: true,
      data: {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        tokenType: response.data.token_type,
        expiresIn: response.data.expires_in
      }
    };
  } catch (error: any) {
    console.error('[OAuth2] Token刷新失败:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error_description || error.message || 'Token刷新失败'
    };
  }
}

/**
 * 获取当前登录用户信息
 * @param accessToken - 访问令牌
 * @returns 用户信息
 */
export async function getUserInfo(accessToken: string) {
  try {
    console.log('[OAuth2] 获取用户信息...');

    const response = await axios.get(AUTH_CONFIG.userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log('[OAuth2] 用户信息获取成功', {
      userId: response.data.data?.userId,
      userName: response.data.data?.userLoginName,
      cnName: response.data.data?.cnName
    });

    return {
      success: true,
      data: response.data.data
    };
  } catch (error: any) {
    console.error('[OAuth2] 用户信息获取失败:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message || '获取用户信息失败'
    };
  }
}

/**
 * 验证Token有效性
 * @param accessToken - 访问令牌
 * @returns 是否有效
 */
export async function validateToken(accessToken: string): Promise<boolean> {
  try {
    const result = await getUserInfo(accessToken);
    return result.success;
  } catch (error) {
    return false;
  }
}

/**
 * 获取登出ticket
 * @param accessToken - 访问令牌
 * @returns logoutTicket
 */
export async function getLogoutTicket(accessToken: string) {
  try {
    console.log('[OAuth2] 获取登出ticket...');

    const response = await axios.post(
      AUTH_CONFIG.logoutTicketUrl,
      {},
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        withCredentials: true
      }
    );

    if (response.data.success && response.data.data) {
      console.log('[OAuth2] 登出ticket获取成功');
      return {
        success: true,
        data: response.data.data
      };
    } else {
      throw new Error(response.data.msg || '获取登出ticket失败');
    }
  } catch (error: any) {
    console.error('[OAuth2] 获取登出ticket失败:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.msg || error.message || '获取登出ticket失败'
    };
  }
}

/**
 * 设置Token到Cookie
 * @param res - Express响应对象
 * @param tokenData - Token数据
 */
export function setTokenToCookie(res: Response, tokenData: any) {
  const cookieOptions = {
    httpOnly: false, // 允许前端访问，便于显示用户信息
    secure: process.env.NODE_ENV === 'production', // 生产环境使用HTTPS
    sameSite: 'lax' as const,
    maxAge: (tokenData.expiresIn || 1800) * 1000 // 转换为毫秒
  };

  // 设置access_token
  res.cookie('oauth_access_token', tokenData.accessToken, cookieOptions);
  
  // 设置refresh_token
  if (tokenData.refreshToken) {
    res.cookie('oauth_refresh_token', tokenData.refreshToken, {
      ...cookieOptions,
      httpOnly: true // refresh_token设置为httpOnly，更安全
    });
  }
  
  // 设置token_type
  res.cookie('oauth_token_type', tokenData.tokenType || 'Bearer', cookieOptions);
  
  // 设置expires_in
  res.cookie('oauth_expires_in', String(tokenData.expiresIn), cookieOptions);
  
  console.log('[OAuth2] Token已保存到Cookie');
}

/**
 * 清除Cookie中的Token
 * @param res - Express响应对象
 */
export function clearTokenCookie(res: Response) {
  res.clearCookie('oauth_access_token');
  res.clearCookie('oauth_refresh_token');
  res.clearCookie('oauth_token_type');
  res.clearCookie('oauth_expires_in');
  res.clearCookie('oauth_user_info');
  
  console.log('[OAuth2] Cookie中的Token已清除');
}

export default {
  generateAuthorizeUrl,
  exchangeCodeForToken,
  refreshToken,
  getUserInfo,
  validateToken,
  getLogoutTicket,
  setTokenToCookie,
  clearTokenCookie,
  config: AUTH_CONFIG
};
