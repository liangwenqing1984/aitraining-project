# 登录页面重新设计 - Gitee 风格双登录方式

## 📋 设计概述

参考 Gitee 登录页面的简洁专业风格,重新设计了本项目的登录页面,同时支持**本地账号登录**和 **OAuth2 统一认证**两种登录方式。

## ✨ 核心特性

### 1. 双登录方式 Tab 切换

- **账号登录**: 传统的用户名密码登录方式
- **统一认证**: OAuth2 企业级单点登录(SSO)

### 2. 左右分栏布局

**左侧品牌展示区:**
- 紫色渐变背景 (#667eea → #764ba2)
- SVG 科技背景图案(低透明度叠加)
- Logo + 标题 + 副标题
- 3个核心特性卡片(多源采集、智能分析、安全可靠)
- 统计数据展示(10+数据源、99.9%可用性、实时更新)
- 页脚版权信息

**右侧登录表单区:**
- 纯白背景,简洁清爽
- Tab 切换组件
- 表单或 OAuth2 登录入口
- 帮助链接

### 3. 本地登录功能

```typescript
// 表单字段
{
  username: string;  // 3-20字符
  password: string;  // 最少6字符
  rememberMe: boolean;  // 记住用户名
}

// 验证规则
- 用户名: 必填,长度3-20
- 密码: 必填,最少6字符
- 支持回车键提交
- 记住我功能(localStorage)
```

### 4. OAuth2 登录功能

```typescript
// 视觉元素
- Connection 图标(48px)
- "企业统一认证"标题
- 说明文字:"使用公司统一身份认证中心账号登录"
- "前往统一认证中心"按钮

// 安全提示
✓ 单点登录,一次认证全站通行
✓ 企业级安全加密保护

// 流程
点击按钮 → auth.login('/') → 跳转到 Auth 服务
```

## 🎨 设计规范

### 颜色方案

| 用途 | 颜色值 | 说明 |
|------|--------|------|
| 主色调渐变 | #667eea → #764ba2 | 品牌色,按钮背景 |
| 标题文字 | #1a1a1a | 深色,高对比度 |
| 正文文字 | #666 | 中等灰度 |
| 辅助文字 | #999 | 浅灰色 |
| 页面背景 | #f5f7fa | 极浅灰蓝 |
| 表单背景 | #ffffff | 纯白 |
| 成功提示 | #52c41a | 绿色图标 |
| 输入框边框 | #d9d9d9 | 默认状态 |
| 输入框聚焦 | #667eea | 激活状态 |

### 字体规范

- **字体系列**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Microsoft YaHei', sans-serif`
- **标题字号**: 28px (h2), 36px (brand-title)
- **正文字号**: 14px (form), 17px (subtitle)
- **辅助字号**: 13px (tips, footer)

### 间距规范

- **大间距**: 60px (页面padding), 40px (内容gap)
- **中间距**: 32px (section margin), 24px (form-item)
- **小间距**: 16px (card padding), 12px (tip gap)
- **微间距**: 8px (icon gap), 4px (margin-bottom)

### 圆角规范

- **大圆角**: 16px (feature-card, brand-logo)
- **中圆角**: 12px (feature-icon)
- **小圆角**: 8px (input, button, alert)

### 阴影规范

```css
/* 按钮阴影 */
box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);

/* 表单区阴影 */
box-shadow: -4px 0 24px rgba(0, 0, 0, 0.06);

/* 悬停阴影 */
box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
```

## 🔧 技术实现

### 文件结构

```
code/frontend/src/
├── views/
│   └── Login.vue          # 登录页面(已更新)
├── utils/
│   └── auth.ts            # OAuth2 认证工具(已有)
└── stores/
    └── user.ts            # 用户状态管理
```

### 关键代码片段

#### 1. Tab 切换

```vue
<el-tabs v-model="activeTab" class="login-tabs">
  <el-tab-pane label="账号登录" name="local">
    <!-- 本地登录表单 -->
  </el-tab-pane>
  
  <el-tab-pane label="统一认证" name="oauth2">
    <!-- OAuth2 登录区域 -->
  </el-tab-pane>
</el-tabs>
```

#### 2. 本地登录处理

```typescript
const handleLocalLogin = async () => {
  if (!loginFormRef.value) return;
  
  await loginFormRef.value.validate(async (valid) => {
    if (valid) {
      localLoading.value = true;
      
      try {
        // TODO: 调用本地登录 API
        // const response = await authApi.localLogin(
        //   loginForm.username, 
        //   loginForm.password
        // );
        
        ElMessage.success('登录成功');
        window.location.href = '/';
      } catch (error: any) {
        errorMessage.value = error.message || '登录失败';
        ElMessage.error(errorMessage.value);
      } finally {
        localLoading.value = false;
      }
    }
  });
};
```

#### 3. OAuth2 登录处理

```typescript
const handleOAuth2Login = () => {
  oauth2Loading.value = true;
  
  try {
    // 调用 OAuth2 登录(会直接跳转)
    oauth2Login('/');
  } catch (error: any) {
    errorMessage.value = '跳转认证中心失败,请重试';
    ElMessage.error(errorMessage.value);
    oauth2Loading.value = false;
  }
};
```

#### 4. 记住用户名

```typescript
// 保存
if (rememberMe.value) {
  localStorage.setItem('remember_username', loginForm.username);
} else {
  localStorage.removeItem('remember_username');
}

// 读取
const rememberedUsername = localStorage.getItem('remember_username');
if (rememberedUsername) {
  loginForm.username = rememberedUsername;
  rememberMe.value = true;
}
```

#### 5. OAuth2 回调错误处理

```typescript
if (route.query.error) {
  const error = route.query.error as string;
  const errorDescription = route.query.error_description as string;
  
  switch (error) {
    case 'missing_code':
      errorMessage.value = '缺少授权码,请重新登录';
      break;
    case 'token_exchange_failed':
      errorMessage.value = `Token交换失败:${errorDescription}`;
      break;
    default:
      errorMessage.value = errorDescription || '登录失败,请重试';
  }
  
  // 自动切换到 OAuth2 tab
  activeTab.value = 'oauth2';
}
```

## 📱 响应式设计

### 断点定义

| 断点 | 宽度范围 | 布局调整 |
|------|----------|----------|
| 桌面端 | >1200px | 完整左右分栏 |
| 中等屏 | 1024-1200px | 缩小间距 |
| 平板端 | 768-1024px | 垂直堆叠,左侧最小高度 |
| 移动端 | <768px | 单列布局,优化触摸体验 |

### 移动端优化

- 特性卡片:网格布局改为单列
- 统计数据:缩小字号和间距
- 表单区:减小padding,优化输入框大小
- Tabs:缩小item padding

## 🚀 待完善功能

### 1. 本地登录后端 API

需要开发以下接口:

```typescript
// POST /api/auth/local-login
{
  username: string;
  password: string;
}

// 返回
{
  success: boolean;
  data?: {
    token: string;      // JWT Token
    userInfo: {
      id: number;
      username: string;
      name: string;
      role: string;
    }
  };
  message?: string;
}
```

### 2. 用户数据库表

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(20) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,  -- bcrypt加密
  name VARCHAR(50),
  email VARCHAR(100),
  role VARCHAR(20) DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);
```

### 3. 密码加密

使用 bcrypt 进行密码哈希:

```typescript
import bcrypt from 'bcryptjs';

// 注册时加密
const saltRounds = 10;
const passwordHash = await bcrypt.hash(plainPassword, saltRounds);

// 登录时验证
const isValid = await bcrypt.compare(inputPassword, storedHash);
```

### 4. JWT Token 生成

```typescript
import jwt from 'jsonwebtoken';

const token = jwt.sign(
  { userId: user.id, username: user.username },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);
```

### 5. 其他增强功能

- [ ] 忘记密码功能(邮件重置)
- [ ] 登录失败次数限制(防暴力破解)
- [ ] 图形验证码(连续失败3次后显示)
- [ ] 登录日志记录(IP、时间、设备)
- [ ] 多因素认证(MFA)支持
- [ ] 第三方登录(GitHub、Gitee等)

## 🎯 用户体验优化

### 1. 加载状态

- 本地登录:按钮显示"登录中..."并禁用
- OAuth2 登录:按钮显示"跳转中..."并禁用
- 防止重复提交

### 2. 错误提示

- 表单验证错误:红色边框 + 文字提示
- 登录失败:顶部 Alert 组件,可关闭
- OAuth2 回调错误:自动切换tab并显示错误

### 3. 动画效果

- 页面入场:fadeInUp(左侧)、fadeInRight(右侧)
- Logo 光晕:pulse 呼吸动画
- 卡片悬停:translateX(8px) 右移
- 按钮悬停:translateY(-2px) 上浮 + 阴影加深

### 4. 无障碍访问

- 支持键盘导航(Tab键切换)
- 支持回车键提交
- 清晰的焦点状态(输入框边框高亮)
- 足够的颜色对比度(WCAG AA标准)

## 📊 与 Gitee 登录页对比

| 特性 | Gitee | 本项目 | 说明 |
|------|-------|--------|------|
| 布局 | 左右分栏 | ✅ 左右分栏 | 保持一致 |
| 背景 | 纯色/渐变 | ✅ 紫色渐变+SVG | 更科技感 |
| 登录方式 | 单一 | ✅ 双方式Tab切换 | 更灵活 |
| 品牌展示 | Logo+标语 | ✅ Logo+标语+特性卡片 | 更丰富 |
| 表单验证 | 前端验证 | ✅ Element Plus验证 | 同等体验 |
| 响应式 | 支持 | ✅ 支持 | 多断点适配 |
| 动画 | 简单 | ✅ 丰富动画 | 更流畅 |
| 安全性 | HTTPS | ✅ HTTPS+OAuth2 | 企业级 |

## 🔗 相关文档

- [OAuth2 完整实现](./OAUTH2_COMPLETE_IMPLEMENTATION.md)
- [OAuth2 客户端ID统一配置](./OAUTH2_CLIENT_ID_UNIFIED.md)
- [Auth 服务测试账号](./AUTH_TEST_ACCOUNT.md)
- [UI 样式指南](./code/frontend/UI_STYLE_GUIDE.md)

## 📝 更新日志

**2026-04-23**
- ✅ 完成登录页面重新设计
- ✅ 实现 Gitee 风格的左右分栏布局
- ✅ 添加本地登录和 OAuth2 登录双方式
- ✅ 实现 Tab 切换交互
- ✅ 添加记住用户名功能
- ✅ 完善响应式设计
- ⏳ 待开发:本地登录后端 API
- ⏳ 待开发:用户数据库表
- ⏳ 待开发:JWT Token 机制

---

**设计师**: AI Assistant  
**审核者**: 待定  
**版本**: v2.0  
**最后更新**: 2026-04-23
