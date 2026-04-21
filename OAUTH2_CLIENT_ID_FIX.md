# OAuth2 client_id 错误修复说明

## 🐛 问题描述

访问授权URL时报错：
```
Whitelabel Error Page
There was an unexpected error (type=Bad Request, status=400).
[invalid_request] OAuth 2.0 Parameter: client_id
```

## 🔍 根本原因

**client_id 配置错误**：代码中使用了 `aitraining-id`，但Auth服务中注册的应用标识是 `aitraining`（没有 `-id` 后缀）。

### 文档中的不一致

在 `doc/06-开发参考/07-OAUTH2授权码模式对接说明.md` 中发现：

- **第23行**（授权URL示例）：`client_id=aitraining-id` ❌ 错误
- **第63行**（Token交换参数）：`client_id: aitraining` ✅ 正确

这说明文档本身存在笔误，正确的 client_id 应该是 **`aitraining`**。

## ✅ 修复内容

### 1. 后端修复

**文件**: `code/backend/src/services/authService.ts`

```typescript
// 修改前
clientId: 'aitraining-id',  // ❌ 错误

// 修改后
clientId: 'aitraining',     // ✅ 正确
```

### 2. 前端修复

**文件**: `code/frontend/src/utils/auth.ts`

```typescript
// 修改前
clientId: 'aitraining-id',  // ❌ 错误

// 修改后
clientId: 'aitraining',     // ✅ 正确
```

## 🧪 验证步骤

### 1. 重启服务

```bash
# 重启后端
cd code/backend
npm run dev

# 重启前端
cd code/frontend
npm run dev
```

### 2. 清除浏览器缓存

- 按 `Ctrl + Shift + Delete` 清除缓存
- 或使用无痕模式测试

### 3. 重新测试登录流程

1. 访问 `http://localhost:3000`
2. 点击"使用Auth服务登录"
3. 观察跳转的URL应为：
   ```
   http://leaf-auth-server.dev.jinxin.cloud/auth2/oauth2/authorize?
   client_id=aitraining&
   response_type=code&
   scope=openid+all&
   redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback&
   state=xxxxx
   ```
   
   **注意**: `client_id=aitraining`（没有 -id）

4. 输入用户名密码登录
5. 应成功回调到 `/auth/callback`

### 4. 检查控制台日志

应看到：
```javascript
[OAuth2] 跳转到授权页面: http://leaf-auth-server.dev.jinxin.cloud/...
[OAuth2] 收到授权码，开始交换Token...
[OAuth2] Token交换成功 { tokenType: 'Bearer', expiresIn: 1800, ... }
[OAuth2] 用户信息获取成功 { userId: xxx, userName: 'xxx', ... }
```

## 📋 正确的配置汇总

| 配置项 | 正确值 | 说明 |
|--------|--------|------|
| client_id | `aitraining` | ⚠️ 不是 aitraining-id |
| client_secret | `29b9635df0164eb890d99a58ffa7f8f2` | 保持不变 |
| redirect_uri | `http://localhost:3000/auth/callback` | 前端路由 |
| scope | `openid all` | 保持不变 |
| authorizeUrl | `http://leaf-auth-server.dev.jinxin.cloud/auth2/oauth2/authorize` | 保持不变 |
| tokenUrl | `http://leaf-auth-server.dev.jinxin.cloud/auth2/oauth2/token` | 保持不变 |

## ⚠️ 重要提醒

### 1. 如果仍然报错

如果修正后仍然出现 `invalid_request` 错误，可能的原因：

**原因A**: Auth服务中未注册该应用
- **解决**: 联系Auth服务管理员注册应用
- **提供信息**:
  ```
  应用名称: AI训练数据爬虫系统
  client_id: aitraining
  redirect_uri: http://localhost:3000/auth/callback
  scope: openid all
  ```

**原因B**: redirect_uri 不匹配
- **解决**: 确认Auth服务中注册的回调地址与代码中一致
- **检查**: 必须是 `http://localhost:3000/auth/callback`（不是 `/api/auth/callback`）

**原因C**: client_secret 错误
- **解决**: 联系管理员确认正确的 client_secret

### 2. 生产环境注意事项

生产环境需要：
- ✅ 使用HTTPS协议
- ✅ 注册生产环境的redirect_uri
- ✅ 保管好 client_secret，不要提交到Git
- ✅ 考虑使用环境变量管理敏感配置

### 3. 调试技巧

**手动测试授权URL**：
直接在浏览器访问：
```
http://leaf-auth-server.dev.jinxin.cloud/auth2/oauth2/authorize?client_id=aitraining&response_type=code&scope=openid%20all&redirect_uri=http://localhost:3000/auth/callback&state=test123
```

如果能正常显示登录页，说明 client_id 配置正确。

**检查Network请求**：
- F12打开开发者工具
- Network标签筛选 `authorize` 和 `token`
- 查看请求参数是否正确

## 📝 相关文档更新建议

建议更新 `doc/06-开发参考/07-OAUTH2授权码模式对接说明.md`，统一 client_id 为 `aitraining`，避免后续开发人员混淆。

---

**修复完成时间**: 2026-04-21  
**问题类型**: 配置错误  
**影响范围**: OAuth2登录流程  
**修复状态**: ✅ 已修复
