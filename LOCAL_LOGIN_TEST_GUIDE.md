# 本地登录快速测试指南

## 🚀 快速开始

### 1. 启动前端服务

```bash
cd code/frontend
npm run dev
```

访问: `http://localhost:3000/login`

### 2. 测试账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| `admin` | `Admin@admin123` | 管理员 |
| `user` | `User@123456` | 普通用户 |
| `test` | `Test@123456` | 测试用户 |

**提示**: 登录页面会显示这些账号信息,可以直接复制使用。

## ✅ 测试清单

### 基础功能测试

- [ ] **正常登录**
  - 输入正确的用户名和密码
  - 点击"登 录"按钮
  - 观察加载状态(800ms)
  - 看到成功提示"欢迎回来,XXX!"
  - 自动跳转到首页 `/crawler`

- [ ] **错误处理**
  - 输入错误的密码
  - 点击登录
  - 看到红色错误提示"用户名或密码错误"
  - 可以重新输入

- [ ] **表单验证**
  - 不输入用户名,直接点击登录
  - 看到提示"请输入用户名"
  - 输入少于3个字符的用户名
  - 看到提示"用户名长度在 3 到 20 个字符"
  - 输入少于6个字符的密码
  - 看到提示"密码长度不能少于 6 个字符"

- [ ] **记住我功能**
  - 勾选"记住我"复选框
  - 登录成功
  - 关闭浏览器标签页
  - 重新打开登录页
  - 用户名自动填充
  - "记住我"保持勾选状态

### 界面交互测试

- [ ] **Tab 切换**
  - 点击"账号登录" Tab
  - 显示用户名密码表单
  - 点击"统一认证" Tab
  - 显示 OAuth2 登录入口
  - 切换流畅,无闪烁

- [ ] **测试账号提示**
  - 在"账号登录" Tab 下方
  - 看到蓝色渐变提示框
  - 三个测试账号清晰显示
  - 账号密码使用等宽字体

- [ ] **加载状态**
  - 点击登录后按钮变灰
  - 显示"登录中..."文字
  - 无法重复点击
  - 800ms 后恢复或跳转

### 路由守卫测试

- [ ] **未登录访问受保护页面**
  - 清除浏览器数据(F12 → Application → Clear storage)
  - 直接访问 `http://localhost:3000/crawler`
  - 自动跳转到 `/login`
  - URL 包含 `?redirect=/crawler`

- [ ] **已登录访问登录页**
  - 先完成一次登录
  - 手动访问 `http://localhost:3000/login`
  - 自动跳转到首页 `/`

- [ ] **登录后访问子页面**
  - 登录成功后
  - 访问 `/crawler/create`
  - 正常显示创建任务页面
  - 左侧菜单高亮"数据采集"

### 用户信息显示测试

- [ ] **右上角用户信息**
  - 登录成功后查看右上角
  - 显示用户名称(如"系统管理员")
  - 点击头像显示下拉菜单
  - 有"退出登录"选项

- [ ] **不同账号显示不同名称**
  - 用 `admin` 登录 → 显示"系统管理员"
  - 用 `user` 登录 → 显示"普通用户"
  - 用 `test` 登录 → 显示"测试用户"

### 登出功能测试

- [ ] **本地登录登出**
  - 点击头像 → "退出登录"
  - 清除 localStorage 中的用户信息
  - 跳转到登录页 `/login`
  - 再次访问受保护页面需要重新登录

- [ ] **OAuth2 登录登出**
  - 切换到 OAuth2 登录
  - 登录后点击右上角退出
  - 调用 Auth 服务登出接口
  - 清除 Cookie
  - 跳转到登录页

### 数据持久化测试

- [ ] **刷新页面保持登录**
  - 本地登录成功后
  - 按 F5 刷新页面
  - 仍然保持登录状态
  - 用户信息正常显示

- [ ] **关闭浏览器后**
  - 登录成功后关闭浏览器
  - 重新打开浏览器访问系统
  - 如果未勾选"记住我",需要重新登录
  - 如果勾选了"记住我",用户名自动填充但仍需输入密码

## 🔍 调试技巧

### 1. 查看 localStorage

打开浏览器开发者工具 (F12):

```javascript
// Console 中执行
console.log('用户信息:', JSON.parse(localStorage.getItem('user_info')));
console.log('认证状态:', localStorage.getItem('is_authenticated'));
console.log('记住的用户名:', localStorage.getItem('remember_username'));
```

或在 Application 标签页:
- F12 → Application → Local Storage → http://localhost:3000
- 查看 `user_info`, `is_authenticated`, `remember_username`

### 2. 查看路由日志

Console 中会输出路由守卫日志:

```
[Router] 未登录，跳转到登录页
[Router] 已登录，跳转到首页
[Router] 检测到API路径，放行由后端处理: /api/auth/callback
```

### 3. 查看登录日志

Login.vue 中的关键日志:

```
[Login] 本地登录失败: 用户名或密码错误
[Login] OAuth2 登录失败: 跳转认证中心失败,请重试
```

MainLayout.vue 中的用户信息加载日志:

```
[MainLayout] 本地登录用户信息已加载: {name: "系统管理员", loginType: "local"}
[MainLayout] OAuth2 用户信息已加载: {name: "xxx", loginType: "oauth2"}
```

### 4. 模拟网络延迟

当前设置为 800ms,可以在 Login.vue 中修改:

```typescript
await new Promise(resolve => setTimeout(resolve, 800)); // 改为 2000 测试长时间加载
```

### 5. 添加更多测试账号

在 Login.vue 的 `MOCK_USERS` 数组中添加:

```typescript
{
  username: 'developer',
  password: 'Dev@123456',
  name: '开发工程师',
  role: 'developer'
}
```

## 🐛 常见问题排查

### 问题1: 登录后没有跳转

**症状**: 点击登录后停留在登录页,没有跳转到首页

**排查步骤**:
1. 打开 Console 查看是否有错误
2. 检查是否看到"欢迎回来,XXX!"提示
3. 检查 localStorage 中是否有 `user_info`
4. 检查路由守卫日志

**可能原因**:
- JavaScript 错误导致跳转代码未执行
- 浏览器阻止了 `window.location.href`

**解决方法**:
- 查看 Console 错误信息
- 尝试手动访问 `http://localhost:3000/`

### 问题2: 刷新后需要重新登录

**症状**: 登录成功后刷新页面(F5),又回到登录页

**排查步骤**:
1. 检查 localStorage 中是否有 `user_info` 和 `is_authenticated`
2. 检查路由守卫的 `checkAuthentication()` 函数
3. 查看 Console 中是否有解析错误

**可能原因**:
- localStorage 被清除
- JSON 解析失败
- `is_authenticated` 值不是 `"true"`

**解决方法**:
```javascript
// 手动设置测试
localStorage.setItem('user_info', JSON.stringify({
  username: 'admin',
  name: '系统管理员',
  role: 'admin',
  loginTime: new Date().toISOString(),
  loginType: 'local'
}));
localStorage.setItem('is_authenticated', 'true');
location.reload();
```

### 问题3: 右上角不显示用户信息

**症状**: 登录成功后右上角显示"用户"而不是具体名称

**排查步骤**:
1. 检查 MainLayout.vue 的 `onMounted` 是否执行
2. 查看 Console 中的用户信息加载日志
3. 检查 `userInfo.value.name` 的值

**可能原因**:
- localStorage 中的数据格式不正确
- JSON 解析失败
- `name` 字段缺失

**解决方法**:
- 确保 `user_info` 中包含 `name` 字段
- 检查 MainLayout 是否正确导入和调用

### 问题4: 登出后仍能访问受保护页面

**症状**: 点击退出登录后,刷新页面仍能访问系统

**排查步骤**:
1. 检查 localStorage 是否已清除
2. 检查路由守卫是否生效
3. 查看 Console 中的路由日志

**可能原因**:
- localStorage 未被正确清除
- 浏览器缓存了页面
- 路由守卫逻辑有误

**解决方法**:
```javascript
// 手动清除
localStorage.clear();
location.href = '/login';
```

## 📊 测试报告模板

```markdown
## 本地登录功能测试报告

**测试日期**: 2026-04-23
**测试人员**: XXX
**测试环境**: Chrome 120, Windows 11

### 测试结果

| 测试项 | 状态 | 备注 |
|--------|------|------|
| 正常登录(admin) | ✅ 通过 | - |
| 正常登录(user) | ✅ 通过 | - |
| 正常登录(test) | ✅ 通过 | - |
| 错误密码处理 | ✅ 通过 | 显示友好提示 |
| 表单验证 | ✅ 通过 | 所有规则生效 |
| 记住我功能 | ✅ 通过 | 用户名自动填充 |
| Tab 切换 | ✅ 通过 | 流畅无闪烁 |
| 路由守卫 | ✅ 通过 | 未登录正确拦截 |
| 用户信息显示 | ✅ 通过 | 名称正确显示 |
| 登出功能 | ✅ 通过 | 正确清除数据 |
| 刷新保持登录 | ✅ 通过 | localStorage 持久化 |

### 发现的问题

1. 无

### 建议

1. 可以考虑添加密码强度提示
2. 可以增加"忘记密码"功能链接

### 结论

✅ 本地登录功能测试通过,可以进入下一阶段开发。
```

## 🎯 下一步

测试完成后,可以:

1. **继续前端开发**: 完善其他页面和功能
2. **开发后端 API**: 实现真实的用户认证
3. **数据库设计**: 创建 users 表
4. **安全加固**: 添加验证码、限流等

---

**祝测试顺利!** 🎉
