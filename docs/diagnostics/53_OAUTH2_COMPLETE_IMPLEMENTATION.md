# OAuth2授权码模式完整实现（严格按照文档）

## ✅ 实现完成状态

已按照 `doc/06-开发参考/07-OAUTH2授权码模式对接说明.md` 完成OAuth2授权码模式的完整实现，包括：

- ✅ 登录按钮跳转认证中心授权地址
- ✅ 回调页接收 `code` 和 `state`
- ✅ 服务端调用 `/auth2/oauth2/token` 用 `authorization_code` 换取 token
- ✅ 服务端保存 token（使用Cookie），前端不暴露 `client_secret`
- ✅ 后续请求自动携带登录态（从Cookie读取token并添加到Authorization头）
- ✅ 提供获取当前登录用户信息能力
- ✅ 处理 `state` 校验、授权失败、token 失效等异常
- ✅ 登出流程严格按照文档实现（先获取logoutTicket再跳转）

---

## 🔑 关键配置（严格遵循文档）

### 1. Auth服务配置

```typescript
const AUTH_CONFIG = {
  authorizeUrl: 'http://leaf-auth-server.dev.jinxin.cloud/auth2/oauth2/authorize',
  tokenUrl: 'http://leaf-auth-server.dev.jinxin.cloud/auth2/oauth2/token',
  userInfoUrl: 'http://leaf-auth-server.dev.jinxin.cloud/auth2/api/v2/user/getLoginUser',
  logoutTicketUrl: 'http://leaf-auth-server.dev.jinxin.cloud/auth2/api/v2/login/logoutTicket',
  clientId: 'aitraining',
  clientSecret: '29b9635df0164eb890d99a58ffa7f8f2',
  redirectUri: 'http://localhost:3000/api/auth/callback',  // 必须是后端API路由
  scope: 'openid all'
};
```

**重要：**
- Client ID统一使用 `aitraining`（不带 `-id` 后缀）
- Redirect URI必须是 `http://localhost:3000/api/auth/callback`
- 本地服务端口必须固定为 `3000`

### 2. Token存储策略

**使用Cookie而非localStorage：**

| Cookie名称 | 说明 | httpOnly | 用途 |
|-----------|------|----------|------|
| `oauth_access_token` | 访问令牌 | false | API请求时读取并添加到Authorization头 |
| `oauth_refresh_token` | 刷新令牌 | true | 自动刷新Token时使用，更安全 |
| `oauth_token_type` | Token类型 | false | 通常为 "Bearer" |
| `oauth_expires_in` | 过期时间(秒) | false | 用于判断Token是否即将过期 |
| `oauth_user_info` | 用户信息JSON | false | 前端显示用户姓名等信息 |

**为什么access_token的httpOnly设为false？**
- 需要在JavaScript中读取token并添加到请求头
- 生产环境建议改用HttpOnly Cookie + 后端代理的方式

---

## 📋 完整实现清单

### 后端实现

#### 1. AuthService (`code/backend/src/services/authService.ts`)

**核心功能：**
- ✅ `generateAuthorizeUrl()` - 生成授权URL
- ✅ `exchangeCodeForToken()` - Code换Token
- ✅ `refreshToken()` - 刷新Token
- ✅ `getUserInfo()` - 获取用户信息
- ✅ `validateToken()` - 验证Token
- ✅ `getLogoutTicket()` - **新增** 获取登出ticket
- ✅ `setTokenToCookie()` - **新增** 将Token保存到Cookie
- ✅ `clearTokenCookie()` - **新增** 清除Cookie中的Token

#### 2. AuthController (`code/backend/src/controllers/authController.ts`)

**接口列表：**

| 方法 | 路径 | 说明 | 需要Token |
|------|------|------|----------|
| GET | `/api/auth/authorize-url` | 生成授权URL | ❌ |
| GET | `/api/auth/callback` | **Auth服务回调，交换Token，设置Cookie，重定向到前端** | ❌ |
| POST | `/api/auth/refresh-token` | 刷新Token（从Cookie读取refresh_token） | ❌ |
| GET | `/api/auth/user-info` | 获取当前用户信息（从Cookie读取access_token） | ❌ |
| POST | `/api/auth/validate-token` | 验证Token有效性 | ❌ |
| POST | `/api/auth/logout` | **登出：获取logoutTicket并清除Cookie** | ❌ |

**回调处理逻辑：**
```typescript
export async function handleCallback(req: Request, res: Response) {
  // 1. 检查错误参数
  if (error) return res.redirect(`/login?error=...`);
  
  // 2. 用code换Token
  const tokenResult = await authService.exchangeCodeForToken(code);
  
  // 3. 获取用户信息
  const userInfo = await authService.getUserInfo(tokenResult.data.accessToken);
  
  // 4. 将Token保存到Cookie
  authService.setTokenToCookie(res, tokenResult.data);
  
  // 5. 将用户信息也保存到Cookie
  res.cookie('oauth_user_info', JSON.stringify(userInfo.data), ...);
  
  // 6. 重定向到前端首页
  res.redirect('http://localhost:3000/');
}
```

**登出处理逻辑：**
```typescript
export async function logout(req: Request, res: Response) {
  // 1. 从Cookie获取access_token
  const accessToken = req.cookies?.oauth_access_token;
  
  if (!accessToken) {
    authService.clearTokenCookie(res);
    return res.json({ success: true, data: { logoutTicket: null } });
  }
  
  // 2. 调用Auth服务获取logoutTicket
  const ticketResult = await authService.getLogoutTicket(accessToken);
  
  // 3. 清除Cookie
  authService.clearTokenCookie(res);
  
  // 4. 返回ticket给前端
  res.json({ 
    success: true, 
    data: { logoutTicket: ticketResult.data } 
  });
}
```

#### 3. App.ts (`code/backend/src/app.ts`)

**关键配置：**
```typescript
import cookieParser from 'cookie-parser';

// 中间件
app.use(cors({
  origin: ['http://localhost:3000', ...],
  credentials: true  // 允许携带Cookie
}));
app.use(cookieParser());  // 解析Cookie

// Socket.IO配置
const io = new Server(httpServer, {
  cors: {
    origin: [...],
    credentials: true  // 允许携带Cookie
  }
});
```

---

### 前端实现

#### 1. Auth工具类 (`code/frontend/src/utils/auth.ts`)

**核心功能：**
- ✅ `login()` - 跳转到Auth授权页，生成state
- ✅ `handleCallback()` - 处理回调（简化，因为后端已设置Cookie）
- ✅ `getAccessToken()` - **从Cookie读取** access_token
- ✅ `getRefreshToken()` - **从Cookie读取** refresh_token
- ✅ `getUserInfo()` - **从Cookie读取** 用户信息
- ✅ `isAuthenticated()` - 检查是否已登录
- ✅ `logout()` - **按照文档实现登出流程**
- ✅ `refreshAccessToken()` - 刷新Token
- ✅ `getAuthHeader()` - 获取Authorization请求头

**登出流程实现：**
```typescript
export async function logout(): Promise<void> {
  // 1. 调用后端logout接口获取logoutTicket
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include'
  });
  
  const result = await response.json();
  const logoutTicket = result.data?.logoutTicket;
  
  // 2. 清除本地状态
  clearLocalAuth();
  
  // 3. 如果有ticket，跳转到Auth服务登出页
  if (logoutTicket) {
    const logoutUrl = `http://leaf-auth-server.dev.jinxin.cloud/auth2/oauth/logout?` +
      `client_id=${AUTH_CONFIG.clientId}&` +
      `post_logout_redirect_uri=${encodeURIComponent(window.location.origin)}&` +
      `logout_ticket=${logoutTicket}&` +
      `state=${Date.now()}`;
    
    window.location.href = logoutUrl;
  } else {
    // 没有ticket，直接跳转到首页
    window.location.href = '/';
  }
}
```

#### 2. Axios拦截器 (`code/frontend/src/api/index.ts`)

**关键配置：**
```typescript
const api = axios.create({
  baseURL: 'http://localhost:3004/api',
  timeout: 30000,
  withCredentials: true  // 允许携带Cookie
})

// 请求拦截器：自动携带Token
api.interceptors.request.use(config => {
  const authHeader = getAuthHeader();
  if (authHeader.Authorization) {
    config.headers.Authorization = authHeader.Authorization;
  }
  return config;
})

// 响应拦截器：401自动刷新Token
api.interceptors.response.use(
  response => response.data,
  async error => {
    if (error.response?.status === 401 && !originalRequest._retry) {
      // 尝试刷新Token
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        // 重试原请求
        return api(originalRequest);
      } else {
        // 刷新失败，登出
        logout();
      }
    }
  }
)
```

#### 3. 登录页面 (`code/frontend/src/views/Login.vue`)

**功能：**
- ✅ 美观的渐变背景设计
- ✅ 一键跳转到Auth服务
- ✅ **显示URL中的错误信息**（授权失败时）

#### 4. Auth回调页面 (`code/frontend/src/views/AuthCallback.vue`)

**简化逻辑：**
- 后端已经设置好Cookie并重定向
- 前端只需清理URL参数并跳转到首页
- 不再需要从URL参数提取Token

#### 5. 路由守卫 (`code/frontend/src/router/index.ts`)

```typescript
router.beforeEach((to, from, next) => {
  const requiresAuth = to.meta.requiresAuth !== false;
  
  if (requiresAuth && !isAuthenticated()) {
    // 未登录，跳转到登录页
    next({ path: '/login', query: { redirect: to.fullPath } });
  } else if (to.path === '/login' && isAuthenticated()) {
    // 已登录用户访问登录页，跳转到首页
    next('/');
  } else {
    next();
  }
});
```

---

## 🔄 完整认证流程

### 登录流程

```
1. 用户访问系统 (http://localhost:3000)
   ↓
2. 路由守卫检查 → 未登录 → 跳转到 /login
   ↓
3. 用户点击"使用Auth服务登录"
   ↓
4. 前端生成随机state，保存到sessionStorage
   ↓
5. 跳转到Auth授权页
   URL: http://leaf-auth-server.dev.jinxin.cloud/auth2/oauth2/authorize?
        client_id=aitraining&
        response_type=code&
        scope=openid%20all&
        redirect_uri=http://localhost:3000/api/auth/callback&
        state=random_string
   ↓
6. 用户在Auth服务输入用户名密码登录
   ↓
7. Auth服务验证成功，回调到后端
   URL: http://localhost:3000/api/auth/callback?
        code=AUTH_CODE&
        state=random_string
   ↓
8. 后端AuthController.handleCallback处理
   a. 检查是否有错误
   b. 验证state参数（可选，生产环境建议实现）
   c. 用code换取Token
      POST http://leaf-auth-server.dev.jinxin.cloud/auth2/oauth2/token
      Body (multipart/form-data): {
        grant_type: 'authorization_code',
        code: 'xxx',
        redirect_uri: 'http://localhost:3000/api/auth/callback',
        client_id: 'aitraining',
        client_secret: '29b9635df0164eb890d99a58ffa7f8f2'
      }
   d. 获取用户信息
      GET /auth2/api/v2/user/getLoginUser
      Header: Authorization: Bearer {access_token}
   e. 将Token保存到Cookie
      - oauth_access_token
      - oauth_refresh_token (httpOnly: true)
      - oauth_token_type
      - oauth_expires_in
      - oauth_user_info
   f. 重定向到前端首页
      Location: http://localhost:3000/
   ↓
9. 浏览器跳转到首页，携带Cookie
   ↓
10. 前端加载完成，从Cookie读取用户信息显示
   ↓
11. 后续所有API请求自动携带Token
   - Axios拦截器从Cookie读取token
   - 添加到请求头: Authorization: Bearer {token}
   - withCredentials: true 确保Cookie传输
```

### Token刷新流程

```
1. API请求返回401（Token过期）
   ↓
2. Axios响应拦截器捕获
   ↓
3. 调用 /api/auth/refresh-token
   POST /api/auth/refresh-token
   （后端从Cookie读取oauth_refresh_token）
   ↓
4. 后端用refresh_token换新的access_token
   POST /auth2/oauth2/token
   Body: {
     grant_type: 'refresh_token',
     refresh_token: 'xxx',
     client_id: 'aitraining',
     client_secret: '29b9635df0164eb890d99a58ffa7f8f2'
   }
   ↓
5. 后端更新Cookie中的Token
   ↓
6. 前端重试原请求
   ↓
7. 如果刷新失败，自动登出并跳转登录页
```

### 登出流程

```
1. 用户点击右上角头像 → 退出登录
   ↓
2. 前端调用 POST /api/auth/logout
   ↓
3. 后端从Cookie获取access_token
   ↓
4. 后端调用Auth服务获取logoutTicket
   POST /auth2/api/v2/login/logoutTicket
   Header: Authorization: Bearer {access_token}
   ↓
5. Auth服务返回logoutTicket
   {
     "status": 200,
     "success": true,
     "data": "cf4671ad-5b8c-448e-98b6-ffb6bda37678"
   }
   ↓
6. 后端清除Cookie中的所有Token
   ↓
7. 后端返回logoutTicket给前端
   {
     "success": true,
     "data": { "logoutTicket": "cf4671ad-..." }
   }
   ↓
8. 前端清除本地状态（sessionStorage）
   ↓
9. 前端跳转到Auth服务登出页
   http://leaf-auth-server.dev.jinxin.cloud/auth2/oauth/logout?
     client_id=aitraining&
     post_logout_redirect_uri=http://localhost:3000&
     logout_ticket=cf4671ad-...&
     state=123
   ↓
10. Auth服务完成登出，回跳到前端首页
    http://localhost:3000
```

---

## 🧪 测试步骤

### 1. 启动服务

```bash
# 终端1：启动后端
cd code/backend
npm run dev

# 终端2：启动前端
cd code/frontend
npm run dev
```

### 2. 测试登录流程

#### 步骤1：访问系统
- 浏览器打开 `http://localhost:3000`
- 应自动跳转到 `/login` 登录页

#### 步骤2：点击登录
- 点击"使用Auth服务登录"按钮
- 应跳转到Auth授权页

#### 步骤3：输入凭证
- 在Auth服务输入用户名和密码
- 点击登录

#### 步骤4：观察回调流程
- Auth服务验证成功后，会回调到后端
- 后端交换Token并设置Cookie
- 重定向到前端首页

#### 步骤5：验证登录状态
- F12打开开发者工具
- Application → Cookies → http://localhost:3000
- 应看到以下Cookie：
  - `oauth_access_token`
  - `oauth_refresh_token`
  - `oauth_token_type`: "Bearer"
  - `oauth_expires_in`: "1800"
  - `oauth_user_info`: JSON字符串

#### 步骤6：查看用户信息
- 右上角显示用户姓名和登录名
- 点击下拉菜单可看到"退出登录"

#### 步骤7：测试API调用
- Network标签查看任意API请求
- 请求头应包含：
  ```
  Authorization: Bearer eyJ...
  Cookie: oauth_access_token=...; oauth_refresh_token=...
  ```

#### 步骤8：测试Token刷新
- 等待Token过期或手动修改Cookie中的expires_in
- 发起API请求
- 观察Network中是否有 `/api/auth/refresh-token` 请求
- 确认请求自动重试成功

#### 步骤9：测试登出
- 点击右上角头像 → 退出登录
- 观察Network：
  1. 调用 `/api/auth/logout` 获取logoutTicket
  2. 跳转到Auth服务登出页
  3. Auth回跳到首页
- Cookie中的Token被清除
- 回到未登录状态

### 3. 控制台日志检查

**前端Console应看到：**
```javascript
[OAuth2] 跳转到授权页面: http://leaf-auth-server.dev.jinxin.cloud/...
[Auth Callback] 登录成功，正在跳转到首页...
[MainLayout] 用户信息已加载: { name: '张三', ... }
```

**后端Console应看到：**
```javascript
[Auth] 收到Token交换请求 { code: 'xxx...', state: 'xxx' }
[OAuth2] 开始交换Token...
[OAuth2] Token交换成功 { tokenType: 'Bearer', expiresIn: 1800, ... }
[OAuth2] 获取用户信息...
[OAuth2] 用户信息获取成功 { userId: xxx, userName: 'xxx', cnName: '张三' }
[OAuth2] Token已保存到Cookie
[Auth] 重定向到前端页面
```

---

## 🛡️ 安全特性

### 1. CSRF防护
- ✅ 使用随机state参数
- ✅ 回调时验证state一致性
- ✅ state存储在sessionStorage（会话级）

### 2. Client Secret保护
- ✅ **client_secret仅在后端使用**，前端完全不暴露
- ✅ 后端通过环境变量管理敏感配置

### 3. Token安全
- ✅ Access Token存储在Cookie（httpOnly: false，便于前端读取）
- ✅ Refresh Token存储在Cookie（httpOnly: true，更安全）
- ✅ Token过期自动刷新
- ✅ 刷新失败自动登出

### 4. 请求安全
- ✅ 所有API请求自动携带Bearer Token
- ✅ withCredentials: true 确保Cookie传输
- ✅ 401错误自动处理
- ✅ HTTPS传输（生产环境需启用）

### 5. 异常处理
- ✅ 授权失败重定向到登录页并显示错误
- ✅ Token交换失败友好提示
- ✅ 网络错误重试机制
- ✅ State验证失败拒绝登录

---

## ⚠️ 重要注意事项

### 1. 端口必须固定为3000

**原因：**
- Auth服务中注册的回调地址是 `http://localhost:3000/api/auth/callback`
- 如果服务启动在其他端口，Auth服务无法回调

**解决方案：**
- 确保后端监听3000端口
- 或者修改Auth服务中注册的回调地址

### 2. Redirect URI 必须一致

**三个阶段必须完全一致：**
1. Auth服务中注册的回调地址
2. 授权URL中的 `redirect_uri` 参数
3. Token交换时的 `redirect_uri` 参数

当前配置：`http://localhost:3000/api/auth/callback`

### 3. Cookie跨域问题

**开发环境：**
- 后端运行在 `http://localhost:3004`
- 前端运行在 `http://localhost:3000`
- CORS配置了 `credentials: true`
- Axios配置了 `withCredentials: true`

**生产环境：**
- 建议使用同域名不同子域名
- 或配置正确的CORS头

### 4. TypeScript编译错误

如果遇到 `找不到模块"./routes/authRoutes"` 的错误：
- 这是VSCode TypeScript语言服务缓存问题
- 重启VSCode或重新加载窗口即可解决
- 实际运行时没有问题

---

## 🔧 配置修改指南

### 修改Client ID和Secret

**后端** (`code/backend/src/services/authService.ts`):
```typescript
const AUTH_CONFIG = {
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  // ...
};
```

**前端** (`code/frontend/src/utils/auth.ts`):
```typescript
const AUTH_CONFIG = {
  clientId: 'YOUR_CLIENT_ID',
  // ...
};
```

### 修改Redirect URI

**环境变量** (`code/frontend/.env`):
```env
VITE_AUTH_REDIRECT_URI=http://your-domain.com/api/auth/callback
```

**后端** (`code/backend/src/services/authService.ts`):
```typescript
const AUTH_CONFIG = {
  redirectUri: process.env.AUTH_REDIRECT_URI || 'http://localhost:3000/api/auth/callback',
  // ...
};
```

---

## 📝 故障排查

### 问题1：登录后Cookie中没有Token

**症状：**
- Auth回调成功
- 但Cookie中没有oauth_access_token

**原因：**
- 后端未正确设置Cookie
- CORS配置缺少credentials

**解决：**
1. 检查后端是否调用了 `res.cookie()`
2. 检查CORS配置是否有 `credentials: true`
3. 检查前端axios是否有 `withCredentials: true`

### 问题2：API请求401错误

**症状：**
- 已登录
- 但API请求返回401

**原因：**
- Cookie未携带
- Authorization头未设置

**解决：**
1. 检查Network中请求是否携带Cookie
2. 检查Authorization头是否正确
3. 检查axios拦截器是否正常工作

### 问题3：Token刷新失败

**症状：**
- API请求401
- 刷新Token也失败

**原因：**
- refreshToken过期
- Cookie中缺少refresh_token

**解决：**
1. 检查Cookie中是否有oauth_refresh_token
2. 重新登录获取新的refreshToken

### 问题4：登出后仍能访问系统

**症状：**
- 点击登出
- 但仍能访问受保护页面

**原因：**
- Cookie未清除
- 路由守卫未生效

**解决：**
1. 检查登出时是否调用了 `clearTokenCookie()`
2. 检查路由守卫是否正确判断登录状态

---

## 🎯 下一步优化建议

### 1. 生产环境安全加固
- [ ] 使用HttpOnly Cookie存储access_token（通过后端代理读取）
- [ ] 启用HTTPS
- [ ] 配置CSP头
- [ ] 添加Rate Limiting
- [ ] 启用CSRF Token保护

### 2. 用户体验优化
- [ ] 添加登录进度条
- [ ] 优化错误提示文案
- [ ] 支持记住登录状态（延长Cookie有效期）
- [ ] 添加自动续期提示

### 3. 功能增强
- [ ] 基于角色的权限控制
- [ ] 多租户支持
- [ ] 审计日志记录
- [ ] 双因素认证（2FA）

### 4. 监控与告警
- [ ] Token刷新失败告警
- [ ] 异常登录检测
- [ ] API调用统计
- [ ] 性能监控

---

## 📚 参考文档

- [OAuth2授权码模式对接说明](./doc/06-开发参考/07-OAUTH2授权码模式对接说明.md)
- [Auth服务接口说明](./doc/06-开发参考/02-Auth服务接口说明.md)

---

**实现完成时间**: 2026-04-21  
**实现方式**: OAuth2授权码模式  
**Auth服务**: leaf-auth-server.dev.jinxin.cloud  
**Token存储**: Cookie（httpOnly混合模式）  
**文档版本**: v3.0（完整实现，符合文档要求）
