# RBAC 系统优化与稳定性修复

> 日期：2026-05-08
> commit: `fa914c9`

## 一、问题清单

| # | 问题 | 影响 | 根因 |
|---|------|------|------|
| 1 | 权限管理页面无数据 | 页面空白，无法分配权限 | 种子数据只建菜单+角色，未插入权限记录 |
| 2 | 创建时间时区不对 | 时间戳显示UTC而非北京时间 | PostgreSQL 连接未设置时区，默认跟随服务器 |
| 3 | 本地登录用硬编码账号 | 无法对接真实用户表 | Login.vue 使用 MOCK_USERS 数组模拟 |

## 二、权限种子数据修复

### 问题诊断

`seedService.ts` 初始化流程缺失权限创建步骤：

```
原流程: Step 1 菜单 → Step 2 角色 → Step 3 用户
缺失:   ❌ 未创建任何 sp_permissions 记录
```

角色创建时也未关联权限ID，导致管理员角色空有菜单权限。

### 修复方案

**1. seedService.ts 增加 Step 1 — 权限初始化**

9 个资源模块共 29 条权限：

| 资源 | 操作 | 条数 |
|------|------|------|
| user | view / create / edit / delete | 4 |
| role | view / create / edit / delete | 4 |
| permission | view / create / edit / delete | 4 |
| menu | view / create / edit / delete | 4 |
| task | view / create / edit / delete | 4 |
| file | view / upload / delete | 3 |
| analysis | view / execute | 2 |
| llm | view / edit | 2 |
| rag | use / manage | 2 |

**2. 管理员角色关联权限**

```typescript
const adminRole = await roleService.createRole({
  name: '系统管理员', code: 'admin', ...
  permissionIds,  // ← 新增：所有29条权限ID
  menuIds: allMenuIds,
});
```

**3. 存量数据库补录**

已运行的数据库（种子已跳过）通过临时脚本直接 INSERT，确保现有环境立即可用。

## 三、北京时区配置

### 问题诊断

所有 `TIMESTAMP` 列定义为 `DEFAULT CURRENT_TIMESTAMP`，但 PostgreSQL 连接未设时区，`NOW()` 返回服务器所在时区（通常 UTC），导致前端显示时间比北京时间晚 8 小时。

### 修复方案

`database.ts` 两处加时区设置：

**连接池级别** — 每个新客户端连接自动执行：
```typescript
pool.on('connect', (client) => {
  client.query("SET timezone = 'Asia/Shanghai'")
    .catch(err => console.error('[DB Pool] 设置时区失败:', err.message));
});
```

**初始化连接** — `initDatabase()` 建表前：
```typescript
await client.query("SET timezone = 'Asia/Shanghai'");
```

### 效果

- `CURRENT_TIMESTAMP` / `NOW()` 统一返回北京时间（例：`2026-05-08 14:30:00`）
- `TIMESTAMP` 列（无时区类型）存储纯时间值，不带 `+08` 后缀
- 影响全局：所有 new/update 操作的时间字段全部采用北京时区
- 连接级设置：跟随客户端生命周期，无需每次查询重复 SET

## 四、本地登录对接真实数据库

### 修复前

Login.vue 硬编码 3 个测试账号：
```javascript
const MOCK_USERS = [
  { username: 'admin', password: 'Admin@admin123', ... },
  { username: 'user', password: 'User@123456', ... },
  { username: 'test', password: 'Test@123456', ... },
];
```

登录逻辑包含 `await new Promise(resolve => setTimeout(resolve, 800))` 模拟延迟。

### 修复后

- 调用 `POST /api/auth/local-login` 真实 API
- `authController.localLogin()` 对接 PostgreSQL `sp_users` 表
- bcryptjs 验证 `password_hash`
- 返回完整用户信息（角色、权限、邮箱、手机号）

### 登录验证流程

```
前端 fetch('/api/auth/local-login')
  → authController.localLogin()
    → userService.listUsers(keyword)  // 查找用户
    → db.prepare('SELECT password_hash ...')  // 取密码哈希
    → userService.verifyPassword()  // bcrypt 比对
    → 返回 { username, name, roles, roleIds, email, phone, loginType }
  → 前端存入 localStorage
  → 路由守卫放行
```

## 五、种子数据完整流程

```
服务器启动 → index.ts
  → initDatabase()  // 建表 + 设置时区
  → llmService.initialize()
  → runSeed()       // 检查 sp_menus 是否为空
    ├── Step 1: 创建 29 条权限
    ├── Step 2: 创建 16 条菜单（含 4 条系统管理子菜单）
    ├── Step 3: 创建管理员角色（关联全部权限 + 菜单）
    └── Step 4: 创建管理员用户（admin / Admin@admin123）
  → httpServer.listen()
```

首次启动时 `sp_menus` 表为空 → 执行全部步骤。
后续启动检测到菜单已存在 → 跳过种子初始化。

## 六、已验证项

- [x] TypeScript 编译零错误
- [x] 29 条权限记录已插入数据库
- [x] 管理员角色关联全部权限（sp_role_permissions 表验证）
- [x] 权限管理页面正常显示 29 条数据
- [x] 角色管理页面可看到已分配的权限和菜单
- [x] 管理员账号 admin / Admin@admin123 可登录
- [x] 创建时间采用北京时间且不带时区

## 七、相关提交

| commit | 说明 |
|--------|------|
| `0df411e` | 种子数据自动初始化 + 本地登录对接真实 API |
| `d80adc2` | 种子数据补充权限记录 — 29 条权限 + 管理员角色关联 |
| `fa914c9` | 数据库连接时区设为北京时间（Asia/Shanghai） |
