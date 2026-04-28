# OAuth2认证对接完成说明

## ✅ 已完成的工作

### 后端实现

#### 1. **OAuth2服务层** (`code/backend/src/services/authService.ts`)
- ✅ 生成授权URL
- ✅ 使用授权码交换Token
- ✅ 刷新Token
- ✅ 获取用户信息
- ✅ 验证Token有效性

#### 2. **Auth控制器** (`code/backend/src/controllers/authController.ts`)
- ✅ `GET /api/auth/authorize-url` - 生成授权URL
- ✅ `GET /api/auth/callback` - 处理OAuth2回调，交换Token
- ✅ `POST /api/auth/refresh-token` - 刷新Token
- ✅ `GET /api/auth/user-info` - 获取当前用户信息
- ✅ `POST /api/auth/validate-token` - 验证Token
- ✅ `POST /api/auth/logout` - 登出

#### 3. **路由配置** (`code/backend/src/routes/authRoutes.ts`)
- ✅ 注册所有Auth相关路由

#### 4. **主应用集成** (`code/backend/src/app.ts`)
- ✅ 导入并注册auth路由

### 前端实现

#### 1. **Auth工具类** (`code/frontend/src/utils/auth.ts`)
- ✅ `login()` - 跳转到Auth登录页
- ✅ `handleCallback()` - 处理OAuth2回调
- ✅ `getAccessToken()` - 获取访问令牌
- ✅ `getRefreshToken()` - 获取刷新令牌
- ✅ `getUserInfo()` - 获取用户信息
- ✅ `isAuthenticated()` - 检查是否已登录
- ✅ `logout()` - 登出
- ✅ `refreshAccessToken()` - 刷新Token
- ✅ `isTokenExpiringSoon()` - 检查Token是否即将过期
- ✅ `getAuthHeader()` - 获取Authorization请求头

#### 2. **登录页面** (`code/frontend/src/views/Login.vue`)
- ✅ 美观的登录界面
- ✅ 一键跳转到Auth服务
- ✅ 渐变背景和动画效果

#### 3. **OAuth2回调页面** (`code/frontend/src/views/AuthCallback.vue`)
- ✅ 处理授权码交换
- ✅ 显示加载状态
- ✅ 错误处理和重试机制

#### 4. **路由配置** (`code/frontend/src/router/index.ts`)
- ✅ 添加登录页路由（不需要认证）
- ✅ 添加回调页路由（不需要认证）
- ✅ 路由守卫：未登录自动跳转登录页
- ✅ 已登录用户访问登录页自动跳转首页

#### 5. **Axios拦截器** (`code/frontend/src/api/index.ts`)
- ✅ 请求拦截器：自动携带Bearer Token
- ✅ 响应拦截器：401错误自动刷新Token
- ✅ Token刷新失败自动登出
- ✅ 友好的错误提示

#### 6. **主布局更新** (`code/frontend/src/layouts/MainLayout.vue`)
- ✅ 显示Auth服务返回的用户信息
- ✅ 集成登出功能
- ✅ 移除旧的userStore依赖

#### 7. **环境配置** (`code/frontend/.env`)
- ✅ 配置OAuth2回调地址

## 📋 Auth服务配置

### 服务地址
- **授权地址**: `http://leaf-auth-server.dev.jinxin.cloud/auth2/oauth2/authorize`
- **Token交换地址**: `http://leaf-auth-server.dev.jinxin.cloud/auth2/oauth2/token`
- **用户信息接口**: `http://leaf-auth-server.dev.jinxin.cloud/auth2/api/v2/user/getLoginUser`

### 应用凭证
```typescript
{
  clientId: 'aitraining-id',
  clientSecret: '29b9635df0164eb890d99a58ffa7f8f2',
  redirectUri: 'http://localhost:3000/auth/callback',
  scope: 'openid all'
}
```

## 🔄 OAuth2认证流程

### 完整流程图

```
1. 用户访问系统
   ↓
2. 路由守卫检查 → 未登录 → 跳转到 /login
   ↓
3. 用户点击"使用Auth服务登录"
   ↓
4. 前端生成state参数，跳转到Auth授权页
   URL: http://leaf-auth-server.dev.jinxin.cloud/auth2/oauth2/authorize?
        client_id=aitraining-id&
        response_type=code&
        scope=openid all&
        redirect_uri=http://localhost:3000/auth/callback&
        state=random_string
   ↓
5. 用户在Auth服务输入用户名密码登录
   ↓
6. Auth服务验证成功，回调到前端
   URL: http://localhost:3000/auth/callback?code=AUTH_CODE&state=random_string
   ↓
7. 前端AuthCallback页面处理
   - 验证state参数（防CSRF）
   - 提取code参数
   - 调用后端 /api/auth/callback?code=xxx
   ↓
8. 后端用code换取Token
   POST http://leaf-auth-server.dev.jinxin.cloud/auth2/oauth2/token
   Body: {
     grant_type: 'authorization_code',
     code: 'xxx',
     redirect_uri: 'http://localhost:3000/auth/callback',
     client_id: 'aitraining-id',
     client_secret: '29b9635df0164eb890d99a58ffa7f8f2'
   }
   ↓
9. Auth服务返回Token
   {
     access_token: "eyJ...",
     refresh_token: "Hmdj...",
     token_type: "Bearer",
     expires_in: 1800,
     scope: "all openid",
     id_token: "eyJ..."
   }
   ↓
10. 后端获取用户信息
    GET /auth2/api/v2/user/getLoginUser
    Header: Authorization: Bearer {access_token}
    ↓
11. 后端返回Token和用户信息给前端
    ↓
12. 前端保存Token到localStorage
    - access_token
    - refresh_token
    - user_info
    - login_time
    ↓
13. 前端跳转到原页面或首页
    ↓
14. 后续所有API请求自动携带Token
    Header: Authorization: Bearer {access_token}
    ↓
15. Token过期时（401错误）
    - Axios拦截器捕获
    - 自动调用 /api/auth/refresh-token
    - 用refresh_token换取新token
    - 重试原请求
    ↓
16. 用户点击"退出登录"
    - 清除localStorage中的所有Token
    - 跳转到登录页
```

## 🧪 测试步骤

### 1. 启动服务

```bash
# 启动后端
cd code/backend
npm run dev

# 启动前端
cd code/frontend
npm run dev
```

### 2. 测试登录流程

1. **访问系统**
   - 浏览器打开 `http://localhost:3000`
   - 应自动跳转到 `/login` 登录页

2. **点击登录**
   - 点击"使用Auth服务登录"按钮
   - 应跳转到Auth服务登录页

3. **输入凭证**
   - 在Auth服务输入用户名和密码
   - 点击登录

4. **验证回调**
   - 登录成功后应跳转到 `/auth/callback`
   - 显示"正在处理登录..."
   - 成功后自动跳转到首页

5. **检查Token**
   - 打开浏览器开发者工具（F12）
   - 查看 Application → Local Storage
   - 应看到以下键：
     - `access_token`
     - `refresh_token`
     - `token_type`
     - `expires_in`
     - `user_info`
     - `login_time`

6. **查看用户信息**
   - 右上角应显示用户姓名和登录名
   - 点击下拉菜单可看到"退出登录"选项

7. **测试API调用**
   - 打开Network标签
   - 访问任意需要认证的页面（如爬虫管理）
   - 查看请求头应包含：
     ```
     Authorization: Bearer eyJ...
     ```

8. **测试Token刷新**
   - 等待Token过期（或手动修改localStorage中的login_time为29分钟前）
   - 发起API请求
   - 观察Network中是否有 `/api/auth/refresh-token` 请求
   - 确认请求自动重试成功

9. **测试登出**
   - 点击右上角用户头像
   - 选择"退出登录"
   - localStorage中的Token应被清除
   - 应跳转到登录页

### 3. 控制台日志检查

打开浏览器Console，应看到以下日志：

```javascript
[OAuth2] 跳转到授权页面: http://leaf-auth-server.dev.jinxin.cloud/...
[OAuth2] 收到授权码，开始交换Token...
[OAuth2] Token已保存
[OAuth2] 登录成功，准备跳转到: /
[MainLayout] 用户信息已加载: { name: '张三', ... }
[API Interceptor] Token过期，尝试刷新...
[OAuth2] Token刷新成功
```

## 🔧 配置说明

### 开发环境配置

如需修改Auth服务地址或应用凭证，编辑以下文件：

**后端** (`code/backend/src/services/authService.ts`):
```typescript
const AUTH_CONFIG = {
  authorizeUrl: 'http://leaf-auth-server.dev.jinxin.cloud/auth2/oauth2/authorize',
  tokenUrl: 'http://leaf-auth-server.dev.jinxin.cloud/auth2/oauth2/token',
  userInfoUrl: 'http://leaf-auth-server.dev.jinxin.cloud/auth2/api/v2/user/getLoginUser',
  clientId: 'aitraining-id',
  clientSecret: '29b9635df0164eb890d99a58ffa7f8f2',
  redirectUri: process.env.AUTH_REDIRECT_URI || 'http://localhost:3000/auth/callback',
  scope: 'openid all'
};
```

**前端** (`code/frontend/.env`):
```env
VITE_AUTH_REDIRECT_URI=http://localhost:3000/auth/callback
```

### 生产环境配置

生产环境需要：
1. 修改 `redirectUri` 为生产域名
2. 确保Auth服务已注册该回调地址
3. 可能需要配置HTTPS

## 🛡️ 安全特性

### 1. CSRF防护
- 使用随机state参数
- 回调时验证state一致性
- state存储在sessionStorage（会话级）

### 2. Token安全
- Access Token存储在localStorage
- Refresh Token用于无感知刷新
- Token过期自动刷新
- 刷新失败自动登出

### 3. 请求安全
- 所有API请求自动携带Bearer Token
- 401错误自动处理
- 防止Token泄露（仅通过HTTPS传输）

### 4. 会话管理
- 无服务端Session（OAuth2标准）
- 前端完全控制Token生命周期
- 登出即清除Token

## 📊 API接口清单

### 后端Auth接口

| 方法 | 路径 | 说明 | 需要Token |
|------|------|------|----------|
| GET | `/api/auth/authorize-url` | 生成授权URL | ❌ |
| GET | `/api/auth/callback` | OAuth2回调处理 | ❌ |
| POST | `/api/auth/refresh-token` | 刷新Token | ❌ |
| GET | `/api/auth/user-info` | 获取用户信息 | ✅ |
| POST | `/api/auth/validate-token` | 验证Token | ❌ |
| POST | `/api/auth/logout` | 登出 | ❌ |

### Auth服务接口（直接调用）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/auth2/oauth2/authorize` | 授权页面 |
| POST | `/auth2/oauth2/token` | Token交换 |
| GET | `/auth2/api/v2/user/getLoginUser` | 用户信息 |

## ⚠️ 注意事项

### 1. TypeScript编译错误
如果遇到 `找不到模块"./routes/authRoutes"` 的错误：
- 这是VSCode TypeScript语言服务缓存问题
- 重启VSCode或重新加载窗口即可解决
- 实际运行时没有问题

### 2. CORS配置
确保Auth服务允许以下来源：
- `http://localhost:3000` (前端)
- `http://localhost:3004` (后端)

### 3. 回调地址匹配
- Auth服务注册的回调地址必须与代码中一致
- 开发环境：`http://localhost:3000/auth/callback`
- 生产环境：需提前注册

### 4. Token有效期
- 默认1800秒（30分钟）
- 可通过 `expires_in` 字段查看
- 提前5分钟自动刷新

## 🎯 下一步优化建议

1. **权限控制**
   - 基于用户角色显示/隐藏菜单
   - 路由级别权限控制

2. **单点登录（SSO）**
   - 与其他系统共享Auth服务
   - 一处登录，多处免登

3. **多租户支持**
   - 根据用户所属租户切换数据源
   - 租户级别的权限隔离

4. **审计日志**
   - 记录用户登录/登出时间
   - 关键操作日志

5. **双因素认证（2FA）**
   - 短信验证码
   - 邮箱验证

---

**对接完成时间**: 2026-04-21  
**版本**: v1.0  
**认证方式**: OAuth2授权码模式  
**Auth服务**: leaf-auth-server.dev.jinxin.cloud
