# 本地登录功能实现说明(前端模拟)

## 📋 概述

已实现前端模拟的本地用户名密码登录功能,无需后端支持即可测试使用。

## ✨ 功能特性

### 1. 双登录方式支持

- ✅ **账号登录**: 本地用户名密码验证(前端模拟)
- ✅ **统一认证**: OAuth2 企业统一认证(原有功能)

### 2. 测试账号

系统预置了三个测试账号:

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| 管理员 | `admin` | `Admin@admin123` | 拥有最高权限 |
| 普通用户 | `user` | `User@123456` | 标准用户权限 |
| 测试用户 | `test` | `Test@123456` | 测试用途 |

**提示**: 登录页面"账号登录" Tab 下方会显示这些测试账号信息,方便快速测试。

## 🔧 技术实现

### 1. 前端模拟用户数据

在 `Login.vue` 中定义了模拟用户数组:

```typescript
const MOCK_USERS = [
  {
    username: 'admin',
    password: 'Admin@admin123',
    name: '系统管理员',
    role: 'admin'
  },
  {
    username: 'user',
    password: 'User@123456',
    name: '普通用户',
    role: 'user'
  },
  {
    username: 'test',
    password: 'Test@123456',
    name: '测试用户',
    role: 'user'
  }
];
```

### 2. 登录验证流程

```typescript
// 1. 表单验证(Element Plus)
await loginFormRef.value.validate(async (valid) => {
  if (valid) {
    // 2. 模拟网络延迟(800ms)
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // 3. 查找匹配的用户
    const user = MOCK_USERS.find(
      u => u.username === loginForm.username && 
           u.password === loginForm.password
    );
    
    if (!user) {
      throw new Error('用户名或密码错误');
    }
    
    // 4. 保存用户信息到 localStorage
    const userInfo = {
      username: user.username,
      name: user.name,
      role: user.role,
      loginTime: new Date().toISOString(),
      loginType: 'local'  // 标记为本地登录
    };
    
    localStorage.setItem('user_info', JSON.stringify(userInfo));
    localStorage.setItem('is_authenticated', 'true');
    
    // 5. 跳转到首页
    window.location.href = '/';
  }
});
```

### 3. 记住我功能

```typescript
// 勾选"记住我"时保存用户名
if (rememberMe.value) {
  localStorage.setItem('remember_username', loginForm.username);
} else {
  localStorage.removeItem('remember_username');
}

// 页面加载时自动填充
const rememberedUsername = localStorage.getItem('remember_username');
if (rememberedUsername) {
  loginForm.username = rememberedUsername;
  rememberMe.value = true;
}
```

### 4. 路由认证检查

在 `router/index.ts` 中添加了统一的认证检查函数:

```typescript
function checkAuthentication(): boolean {
  // 1. 检查 OAuth2 登录(Cookie)
  if (isAuthenticated()) {
    return true;
  }
  
  // 2. 检查本地登录(localStorage)
  const localUserInfo = localStorage.getItem('user_info');
  const isLocalAuthenticated = localStorage.getItem('is_authenticated');
  
  if (localUserInfo && isLocalAuthenticated === 'true') {
    try {
      JSON.parse(localUserInfo); // 验证 JSON 格式
      return true;
    } catch (e) {
      // 清除无效数据
      localStorage.removeItem('user_info');
      localStorage.removeItem('is_authenticated');
    }
  }
  
  return false;
}
```

### 5. MainLayout 用户信息显示

更新 `MainLayout.vue` 以支持两种登录方式:

```typescript
onMounted(() => {
  // 优先检查本地登录
  const localUserInfo = localStorage.getItem('user_info');
  const isAuthenticated = localStorage.getItem('is_authenticated');
  
  if (localUserInfo && isAuthenticated === 'true') {
    // 本地登录
    const info = JSON.parse(localUserInfo);
    userInfo.value = {
      name: info.name || '用户',
      userId: info.username,
      loginType: 'local'
    };
    return;
  }
  
  // OAuth2 登录
  const info = getUserInfo();
  if (info) {
    userInfo.value = {
      name: info.cnName || info.userLoginName || '用户',
      userId: info.userId,
      loginType: 'oauth2'
    };
  }
})
```

### 6. 登出逻辑

根据登录类型选择不同的登出方式:

```typescript
const handleLogout = () => {
  if (userInfo.value.loginType === 'local') {
    // 本地登录:清除 localStorage
    localStorage.removeItem('user_info');
    localStorage.removeItem('is_authenticated');
    window.location.href = '/login';
    return;
  }
  
  // OAuth2 登录:调用 auth 服务
  authLogout();
}
```

## 🎨 UI 设计

### 测试账号提示框

在登录表单下方添加了蓝色渐变提示框:

```vue
<el-alert
  title="测试账号"
  type="info"
  :closable="false"
  show-icon
  class="test-accounts-alert"
>
  <div class="test-accounts">
    <div class="account-item">
      <span class="account-label">管理员:</span>
      <code>admin / Admin@admin123</code>
    </div>
    <!-- ... -->
  </div>
</el-alert>
```

**样式特点:**
- 蓝色渐变背景 (#f0f9ff → #e0f2fe)
- 等宽字体显示账号密码
- 清晰的标签和值分离
- 圆角边框,柔和阴影

## 📊 数据存储

### localStorage 键值说明

| 键名 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `user_info` | JSON String | 本地登录用户信息 | `{"username":"admin","name":"系统管理员","role":"admin","loginTime":"2026-04-23T10:00:00.000Z","loginType":"local"}` |
| `is_authenticated` | String | 认证状态标志 | `"true"` |
| `remember_username` | String | 记住的用户名 | `"admin"` |

### Cookie(OAuth2 登录)

| 键名 | 说明 | HttpOnly |
|------|------|----------|
| `oauth_access_token` | Access Token | No |
| `oauth_refresh_token` | Refresh Token | Yes |
| `oauth_user_info` | 用户信息(JSON) | No |

## 🧪 测试步骤

### 1. 本地登录测试

1. 访问 `http://localhost:3000/login`
2. 确保选中"账号登录" Tab
3. 输入测试账号:
   - 用户名: `admin`
   - 密码: `Admin@admin123`
4. (可选)勾选"记住我"
5. 点击"登 录"按钮
6. 观察:
   - 按钮显示"登录中..."加载状态
   - 800ms 后显示成功提示"欢迎回来,系统管理员!"
   - 自动跳转到首页 `/crawler`
   - 右上角显示用户名称
   - 左侧菜单正常工作

### 2. 错误处理测试

1. 输入错误的用户名或密码
2. 点击登录
3. 观察:
   - 顶部显示红色错误提示"用户名或密码错误"
   - ElMessage 弹出错误通知
   - 按钮恢复可点击状态

### 3. 记住我功能测试

1. 首次登录时勾选"记住我"
2. 登录成功后退出浏览器
3. 重新访问登录页
4. 观察:
   - 用户名自动填充
   - "记住我"复选框自动勾选

### 4. 登出测试

1. 登录后点击右上角用户头像
2. 选择"退出登录"
3. 观察:
   - 清除 localStorage 中的用户信息
   - 跳转到登录页 `/login`

### 5. OAuth2 登录对比测试

1. 切换到"统一认证" Tab
2. 点击"前往统一认证中心"
3. 使用 OAuth2 账号登录(`aitraining` / `Admin@admin123`)
4. 观察:
   - 右上角显示 OAuth2 用户信息
   - 与本地登录的用户信息格式不同

## ⚠️ 注意事项

### 1. 安全性警告

**此实现仅用于开发和测试!**

- ❌ **不要在生产环境使用**
- ❌ 密码明文存储在代码中
- ❌ 没有加密传输
- ❌ 没有防暴力破解机制
- ❌ 没有会话管理

### 2. 生产环境要求

正式部署时需要:

- ✅ 后端 API 接口(`/api/auth/local-login`)
- ✅ 数据库存储用户信息(PostgreSQL)
- ✅ 密码 bcrypt 加密
- ✅ JWT Token 生成和验证
- ✅ HTTPS 加密传输
- ✅ 登录失败次数限制
- ✅ 图形验证码
- ✅ 会话超时管理
- ✅ 登录日志记录

### 3. 数据清理

如需清除本地登录数据:

```javascript
// 浏览器控制台执行
localStorage.removeItem('user_info');
localStorage.removeItem('is_authenticated');
localStorage.removeItem('remember_username');
```

或使用浏览器开发者工具:
- F12 → Application → Local Storage → 删除相关键

## 🔄 与 OAuth2 登录的区别

| 特性 | 本地登录 | OAuth2 登录 |
|------|----------|-------------|
| 验证方式 | 前端模拟 | Auth 服务验证 |
| 数据存储 | localStorage | Cookie |
| 用户信息 | 简单对象 | 完整用户档案 |
| 单点登录 | ❌ 不支持 | ✅ 支持 |
| 安全性 | 低(仅测试) | 高(企业级) |
| 适用场景 | 开发测试 | 生产环境 |
| 登出方式 | 清除 localStorage | 调用 Auth 服务 |

## 📝 后续优化建议

### 短期(开发阶段)

1. ✅ 添加更多测试账号
2. ✅ 支持自定义测试账号配置
3. ✅ 添加登录历史记录(内存中)
4. ✅ 模拟不同的用户权限

### 中期(准备生产)

1. ⏳ 开发后端登录 API
2. ⏳ 创建用户数据库表
3. ⏳ 实现密码加密(bcrypt)
4. ⏳ 生成 JWT Token
5. ⏳ 添加登录日志

### 长期(生产优化)

1. ⏳ 多因素认证(MFA)
2. ⏳ 第三方登录(GitHub/Gitee)
3. ⏳ 社交账号绑定
4. ⏳ 密码强度策略
5. ⏳ 账户锁定机制

## 🎯 总结

本次实现了一个**纯前端的模拟登录系统**,主要特点:

1. **快速测试**: 无需后端即可验证登录流程
2. **双模式支持**: 本地登录 + OAuth2 登录并存
3. **完整的用户体验**: 加载状态、错误提示、记住我
4. **清晰的数据隔离**: localStorage vs Cookie
5. **易于扩展**: 预留了后端 API 调用位置

这个实现非常适合:
- ✅ 前端开发阶段的快速原型验证
- ✅ UI/UX 设计和交互测试
- ✅ 路由守卫和权限控制测试
- ✅ 演示和培训用途

**重要提醒**: 正式上线前必须替换为真实的后端认证系统!

---

**实现日期**: 2026-04-23  
**版本**: v1.0 (前端模拟版)  
**状态**: ✅ 开发测试可用 | ⚠️ 不可用于生产
