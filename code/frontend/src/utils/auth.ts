/**
 * OAuth2认证工具类
 * 处理前端OAuth2登录流程、Token管理、路由跳转等
 */

// Auth服务配置（与后端保持一致）
const AUTH_CONFIG = {
  authorizeUrl: 'http://leaf-auth-server.dev.jinxin.cloud/auth2/oauth2/authorize',
  clientId: 'aitraining',
  redirectUri: import.meta.env.VITE_AUTH_REDIRECT_URI || 'http://localhost:3000/api/auth/callback',
  scope: 'openid all'
};

/**
 * 生成随机state参数（防CSRF攻击）
 */
function generateState(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * 获取Cookie值
 */
function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

/**
 * 跳转到Auth登录页
 * @param redirectPath - 登录成功后要跳转的路径
 */
export function login(redirectPath?: string): void {
  const state = generateState();
  
  // 保存state和重定向路径到sessionStorage
  sessionStorage.setItem('oauth_state', state);
  if (redirectPath) {
    sessionStorage.setItem('oauth_redirect_path', redirectPath);
  }

  // 构建授权URL
  const params = new URLSearchParams({
    client_id: AUTH_CONFIG.clientId,
    response_type: 'code',
    scope: AUTH_CONFIG.scope,
    redirect_uri: AUTH_CONFIG.redirectUri,
    state: state
  });

  const authorizeUrl = `${AUTH_CONFIG.authorizeUrl}?${params.toString()}`;
  
  console.log('[OAuth2] 跳转到授权页面:', authorizeUrl);
  
  // 跳转到Auth服务登录页
  window.location.href = authorizeUrl;
}

/**
 * 处理OAuth2回调
 * 从URL中提取code，调用后端接口交换Token
 * @returns Promise<boolean> 是否成功
 */
export async function handleCallback(): Promise<boolean> {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    // 检查是否有错误
    if (error) {
      console.error('[OAuth2] 授权失败:', error);
      const errorDescription = urlParams.get('error_description') || '未知错误';
      throw new Error(errorDescription);
    }

    // 验证state参数（防CSRF）
    const savedState = sessionStorage.getItem('oauth_state');
    if (state !== savedState) {
      console.error('[OAuth2] State验证失败');
      throw new Error('State验证失败，可能存在CSRF攻击');
    }

    if (!code) {
      throw new Error('缺少授权码(code)');
    }

    console.log('[OAuth2] 收到授权码，开始交换Token...');

    // 调用后端接口交换Token（后端会设置Cookie并重定向）
    const response = await fetch('/api/auth/callback', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include' // 重要：允许携带Cookie
    });

    // 后端会直接重定向，所以这里不会执行到
    // 如果执行到这里说明出错了
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('[OAuth2] Token交换完成，已保存到Cookie');

    // 清除临时数据
    sessionStorage.removeItem('oauth_state');
    const redirectPath = sessionStorage.getItem('oauth_redirect_path') || '/';
    sessionStorage.removeItem('oauth_redirect_path');

    console.log('[OAuth2] 登录成功，准备跳转到:', redirectPath);

    // 跳转到原页面或首页
    window.location.href = redirectPath;

    return true;
  } catch (error: any) {
    console.error('[OAuth2] 回调处理失败:', error);
    
    // 清除临时数据
    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('oauth_redirect_path');
    
    throw error;
  }
}

/**
 * 获取Access Token（从Cookie读取）
 */
export function getAccessToken(): string | null {
  return getCookie('oauth_access_token');
}

/**
 * 获取Refresh Token（从Cookie读取）
 */
export function getRefreshToken(): string | null {
  return getCookie('oauth_refresh_token');
}

/**
 * 获取用户信息（从Cookie读取）
 */
export function getUserInfo(): any | null {
  const userInfoStr = getCookie('oauth_user_info');
  if (userInfoStr) {
    try {
      return JSON.parse(decodeURIComponent(userInfoStr));
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * 检查是否已登录
 */
export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

/**
 * 登出（按照文档要求实现）
 * 1. 调用后端logout接口获取logoutTicket
 * 2. 使用logoutTicket跳转到Auth服务登出页
 */
export async function logout(): Promise<void> {
  try {
    console.log('[OAuth2] 开始登出流程...');

    // 调用后端logout接口获取logoutTicket
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });

    const result = await response.json();

    if (!result.success) {
      console.error('[OAuth2] 登出失败:', result.message);
      // 即使失败也清除本地状态
      clearLocalAuth();
      window.location.href = '/login';
      return;
    }

    const logoutTicket = result.data?.logoutTicket;

    console.log('[OAuth2] 获取到logoutTicket:', logoutTicket);

    // 清除本地认证状态
    clearLocalAuth();

    // 如果有logoutTicket，跳转到Auth服务登出页
    if (logoutTicket) {
      const logoutUrl = `http://leaf-auth-server.dev.jinxin.cloud/auth2/oauth/logout?` +
        `client_id=${AUTH_CONFIG.clientId}&` +
        `post_logout_redirect_uri=${encodeURIComponent(window.location.origin)}&` +
        `logout_ticket=${logoutTicket}&` +
        `state=${Date.now()}`;

      console.log('[OAuth2] 跳转到Auth服务登出页:', logoutUrl);
      
      // 跳转到Auth服务登出页
      window.location.href = logoutUrl;
    } else {
      // 没有ticket，直接跳转到首页
      console.log('[OAuth2] 无logoutTicket，直接跳转到首页');
      window.location.href = '/';
    }
  } catch (error) {
    console.error('[OAuth2] 登出异常:', error);
    // 异常情况下也要清除本地状态
    clearLocalAuth();
    window.location.href = '/login';
  }
}

/**
 * 清除本地认证状态
 */
function clearLocalAuth() {
  // 清除sessionStorage中的临时数据
  sessionStorage.removeItem('oauth_state');
  sessionStorage.removeItem('oauth_redirect_path');
  
  console.log('[OAuth2] 本地认证状态已清除');
}

/**
 * 刷新Token
 */
export async function refreshAccessToken(): Promise<boolean> {
  try {
    console.log('[OAuth2] 开始刷新Token...');

    const response = await fetch('/api/auth/refresh-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include' // 携带Cookie
    });

    const result = await response.json();

    if (!result.success) {
      console.error('[OAuth2] Token刷新失败:', result.message);
      logout();
      return false;
    }

    console.log('[OAuth2] Token刷新成功');
    return true;
  } catch (error) {
    console.error('[OAuth2] Token刷新异常:', error);
    logout();
    return false;
  }
}

/**
 * 检查Token是否即将过期（默认提前5分钟刷新）
 */
export function isTokenExpiringSoon(bufferMinutes: number = 5): boolean {
  const expiresIn = parseInt(getCookie('oauth_expires_in') || '0');
  
  if (!expiresIn) {
    return true;
  }

  // 由于无法准确知道token的创建时间，这里采用简化策略
  // 实际项目中应该在服务端判断token是否即将过期
  return false;
}

/**
 * 获取Authorization请求头
 */
export function getAuthHeader(): Record<string, string> {
  const token = getAccessToken();
  const tokenType = getCookie('oauth_token_type') || 'Bearer';
  
  if (token) {
    return {
      'Authorization': `${tokenType} ${token}`
    };
  }
  
  return {};
}

export default {
  login,
  handleCallback,
  logout,
  refreshAccessToken,
  getAccessToken,
  getRefreshToken,
  getUserInfo,
  isAuthenticated,
  isTokenExpiringSoon,
  getAuthHeader
};
