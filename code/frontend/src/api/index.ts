import axios from 'axios'
import { getAuthHeader, refreshAccessToken, logout } from '@/utils/auth'
import { ElMessage } from 'element-plus'

const api = axios.create({
  baseURL: 'http://localhost:3004/api',
  timeout: 30000,
  withCredentials: true // 重要：允许携带Cookie
})

// 是否正在刷新Token的标志
let isRefreshing = false;
// 重试队列
let refreshSubscribers: Array<(token: string) => void> = [];

/**
 * 添加重试请求到队列
 */
function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

/**
 * 执行所有重试请求
 */
function onRefreshed(token: string) {
  refreshSubscribers.forEach(callback => callback(token));
  refreshSubscribers = [];
}

// 请求拦截器：自动携带Token
api.interceptors.request.use(
  config => {
    const authHeader = getAuthHeader();
    if (authHeader.Authorization) {
      config.headers.Authorization = authHeader.Authorization;
    }
    return config;
  },
  error => Promise.reject(error)
)

// 响应拦截器：处理Token过期
api.interceptors.response.use(
  response => response.data,
  async error => {
    const originalRequest = error.config;

    // 如果是401错误且未重试过
    if (error.response?.status === 401 && !originalRequest._retry) {
      
      // 如果正在刷新Token，将请求加入队列
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        console.log('[API Interceptor] Token过期，尝试刷新...');
        
        // 尝试刷新Token
        const refreshed = await refreshAccessToken();
        
        if (refreshed) {
          const newToken = localStorage.getItem('access_token') || 
                          document.cookie.match(/oauth_access_token=([^;]+)/)?.[1];
          
          // 更新原请求的Token
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          
          // 执行队列中的请求
          if (newToken) {
            onRefreshed(newToken);
          }
          
          // 重试原请求
          return api(originalRequest);
        } else {
          // 刷新失败，跳转到登录页
          ElMessage.error('登录已过期，请重新登录');
          logout();
          return Promise.reject(error);
        }
      } catch (refreshError) {
        console.error('[API Interceptor] Token刷新失败:', refreshError);
        ElMessage.error('登录已过期，请重新登录');
        logout();
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    // 其他错误处理
    console.error('API Error:', error)
    
    // 友好的错误提示
    if (error.response) {
      const message = error.response.data?.message || '请求失败';
      ElMessage.error(message);
    } else if (error.code === 'ECONNABORTED') {
      ElMessage.error('请求超时，请稍后重试');
    } else if (error.message === 'Network Error') {
      ElMessage.error('网络连接失败，请检查后端服务是否启动');
    }
    
    return Promise.reject(error)
  }
)

export default api
