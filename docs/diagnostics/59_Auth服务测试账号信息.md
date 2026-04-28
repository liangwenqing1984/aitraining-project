# Auth服务测试账号信息

## 🔑 测试账号

根据 `doc/06-开发参考/01-开发环境配置.md` 文档，当前Auth服务的**统一测试账号**如下：

### 登录凭证

| 字段 | 值 | 说明 |
|------|-----|------|
| **用户名** | `aitraining` | 用于OAuth2授权登录 |
| **密码** | `Admin@admin123` | 默认测试密码 |

---

## 🧪 测试步骤

### 1. 访问系统

浏览器打开：`http://localhost:3000`

### 2. 点击登录

在登录页面点击"使用Auth服务登录"按钮

### 3. 输入凭证

在Auth服务登录页面输入：
- **用户名**: `aitraining`
- **密码**: `Admin@admin123`

### 4. 完成登录

点击登录按钮后，应该能够成功登录并跳转回您的应用。

---

## 📋 OAuth2配置信息

### 应用配置

| 参数 | 值 |
|------|-----|
| **client_id** | `aitraining` |
| **client_secret** | `29b9635df0164eb890d99a58ffa7f8f2` |
| **redirect_uri** | `http://localhost:3000/api/auth/callback` |
| **scope** | `openid all` |

### Auth服务地址

| 接口 | 地址 |
|------|------|
| **授权地址** | `http://leaf-auth-server.dev.jinxin.cloud/auth2/oauth2/authorize` |
| **Token交换** | `http://leaf-auth-server.dev.jinxin.cloud/auth2/oauth2/token` |
| **用户信息** | `http://leaf-auth-server.dev.jinxin.cloud/auth2/api/v2/user/getLoginUser` |
| **基础地址** | `http://leaf-auth-server.dev.jinxin.cloud/` |

---

## ⚠️ 注意事项

### 1. 账号用途

这个测试账号是**企业内部的统一测试账号**，用于开发和测试环境。

### 2. 生产环境

生产环境需要使用**真实的企业账号**，由企业管理员分配。

### 3. 密码安全

- ✅ 开发环境可以使用此测试账号
- ❌ **不要将此密码提交到Git仓库**
- ❌ **不要在生产环境使用此测试账号**

### 4. 账号权限

测试账号可能具有以下限制：
- 仅能访问部分功能
- 数据可能是测试数据
- 可能有有效期限制

---

## 🔍 如果登录失败

### 可能原因1：账号被禁用或过期

**症状：**
- 提示"用户名或密码错误"
- 提示"账号已被禁用"

**解决方案：**
联系Auth服务管理员确认账号状态

### 可能原因2：网络问题

**症状：**
- 无法访问Auth服务登录页
- 连接超时

**解决方案：**
1. 检查网络连接
2. 确认可以访问 `http://leaf-auth-server.dev.jinxin.cloud`
3. 检查是否需要配置代理或VPN

### 可能原因3：配置错误

**症状：**
- 400 Bad Request
- invalid_client 错误

**解决方案：**
1. 确认 `client_id=aitraining`（不带-id后缀）
2. 确认 `redirect_uri` 与注册的一致
3. 检查 `client_secret` 是否正确

---

## 📝 其他测试方式

如果您想直接测试Auth服务的API（不通过OAuth2流程），可以使用以下接口：

### 直接登录接口

```bash
POST http://leaf-auth-server.dev.jinxin.cloud/api/v2/login/authLoginRequest
Content-Type: application/json

{
  "username": "aitraining",
  "password": "Admin@admin123"
}
```

**响应示例：**
```json
{
  "code": "200",
  "message": "成功",
  "data": {
    "userId": "123456",
    "userLoginName": "aitraining",
    "cnName": "测试用户",
    "emailAddress": "test@example.com",
    "accessToken": "eyJ...",
    "refreshToken": "Hmdj..."
  }
}
```

---

## 📚 相关文档

- [开发环境配置](./doc/06-开发参考/01-开发环境配置.md)
- [Auth服务接口说明](./doc/06-开发参考/02-Auth服务接口说明.md)
- [OAuth2授权码模式对接说明](./doc/06-开发参考/07-OAUTH2授权码模式对接说明.md)

---

**最后更新**: 2026-04-21  
**账号来源**: doc/06-开发参考/01-开发环境配置.md
