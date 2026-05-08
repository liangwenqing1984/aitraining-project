# 系统管理 RBAC 全栈实现

> 实施日期：2026-05-08
> commit: `18ede29`

## 一、背景

侧边栏已添加"系统管理"子菜单（用户/角色/权限/菜单管理），但 4 个页面全为 `<el-empty>` 占位，后端完全没有对应 API 和数据库表。

目标：从零搭建完整的 RBAC（基于角色的访问控制）系统，包含前后端全栈实现。

## 二、数据库设计

在 `database.ts` 中新增 7 张表：

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| `sp_users` | 用户表 | username(UNIQUE), password_hash, real_name, email, phone, oauth2_user_id, status |
| `sp_roles` | 角色表 | name, code(UNIQUE), description, status |
| `sp_permissions` | 权限表 | name, code(UNIQUE), resource, action, description |
| `sp_menus` | 菜单表 | name, path, icon, parent_id(自引用FK), sort_order, component, hidden |
| `sp_user_roles` | 用户-角色关联 | user_id(FK), role_id(FK), PK(user_id, role_id) |
| `sp_role_permissions` | 角色-权限关联 | role_id(FK), permission_id(FK), PK(role_id, permission_id) |
| `sp_role_menus` | 角色-菜单关联 | role_id(FK), menu_id(FK), PK(role_id, menu_id) |

### 设计要点

- **用户表兼容 OAuth2**：`oauth2_user_id` 字段可关联外部认证系统用户
- **菜单自引用**：`parent_id` 外键指向自身，支持无限层级树形结构。关联使用 `ON DELETE SET NULL`（删除父菜单时子菜单不会丢失，仅变为顶级）
- **关联表级联删除**：`ON DELETE CASCADE` 确保删除用户/角色时自动清理关联数据
- **编码唯一约束**：角色 code 和权限 code 设置 UNIQUE，防止重复编码导致前端路由混乱

## 三、后端架构

### 3.1 分层结构

```
routes/systemRoutes.ts        ← 统一路由注册（/api/users, /api/roles, /api/permissions, /api/menus）
  ├── controllers/userController.ts     ← 请求参数校验 + 响应格式化
  │   └── services/userService.ts      ← 数据库操作 + bcryptjs 密码哈希
  ├── controllers/roleController.ts
  │   └── services/roleService.ts      ← 角色 CRUD + 权限/菜单关联管理
  ├── controllers/permissionController.ts
  │   └── services/permissionService.ts ← 权限 CRUD + 按 resource 分组
  └── controllers/menuController.ts
      └── services/menuService.ts       ← 菜单 CRUD + 树形构建 + 循环引用检测
```

### 3.2 API 端点清单（21个）

| 模块 | 方法 | 端点 | 说明 |
|------|------|------|------|
| 用户 | GET | `/api/users` | 分页列表（支持 keyword 搜索） |
| | GET | `/api/users/:id` | 详情（含角色列表） |
| | POST | `/api/users` | 创建（密码≥6位，必填用户名+姓名） |
| | PUT | `/api/users/:id` | 更新（密码留空不修改） |
| | DELETE | `/api/users/:id` | 删除（级联清理角色关联） |
| | PUT | `/api/users/:id/roles` | 更新角色分配 |
| 角色 | GET | `/api/roles` | 分页列表 |
| | GET | `/api/roles/all` | 全量（下拉选择用，仅返回 id/name/code） |
| | GET | `/api/roles/:id` | 详情（含 permissionIds + menuIds） |
| | POST | `/api/roles` | 创建（含权限和菜单分配） |
| | PUT | `/api/roles/:id` | 更新 |
| | DELETE | `/api/roles/:id` | 删除 |
| 权限 | GET | `/api/permissions` | 分页列表 |
| | GET | `/api/permissions/all` | 全量（按 resource 分组） |
| | POST | `/api/permissions` | 创建 |
| | PUT | `/api/permissions/:id` | 更新 |
| | DELETE | `/api/permissions/:id` | 删除 |
| 菜单 | GET | `/api/menus` | 平铺列表 |
| | GET | `/api/menus/tree` | 树形结构 |
| | POST | `/api/menus` | 创建 |
| | PUT | `/api/menus/:id` | 更新（含循环引用检测） |
| | DELETE | `/api/menus/:id` | 删除（有子菜单时拒绝） |

### 3.3 关键实现细节

**密码安全**
- 使用 bcryptjs 进行哈希（SALT_ROUNDS=10）
- 编辑时 password 字段留空则保持原密码不变
- 查询用户列表时不返回 password_hash 字段

**菜单循环引用防护**
- `menuService.updateMenu()` 在修改 parentId 时，向上遍历父链检查是否会形成循环引用
- 编辑时通过前端 `menuTreeForSelect` computed 属性过滤自身及后代节点

**角色/权限/菜单关联**
- 更新时采用"先删后插"策略：`DELETE FROM ... WHERE role_id = $1` → 逐条 `INSERT`
- 使用 `ON CONFLICT DO NOTHING` 防止重复插入

**路由顺序**
- `/roles/all` 必须在 `/roles/:id` 之前注册，否则 Express 会将 `all` 匹配为 `:id`
- 同理 `/permissions/all` 先于 `/permissions/:id`，`/menus/tree` 先于 `/menus/:id`

## 四、前端架构

### 4.1 API 层 (`api/system.ts`)

- 复用现有 axios 实例（自动注入 Auth header、token 刷新、错误通知）
- 所有函数返回 `Promise<any>`，类型定义通过接口导出供组件使用
- 遵循现有命名规范：`getXxx`, `createXxx`, `updateXxx`, `deleteXxx`

### 4.2 用户管理页 (Users.vue)

**页面功能**：
- 搜索栏：用户名/姓名/邮箱模糊搜索
- 表格：用户名、真实姓名、邮箱、手机号、角色标签(el-tag)、状态开关、创建时间
- 对话框：基本信息 + 角色多选(el-select multiple) + 状态开关
- 密码字段仅在新建时显示且必填，编辑时留空不修改

**交互**：
- 状态列 inline switch 直接调用 API 更新
- 删除前 `ElMessageBox.confirm` 确认
- 保存按钮 `:loading="saving"` 防止重复提交

### 4.3 角色管理页 (Roles.vue)

**页面功能**：
- 搜索栏：角色名称/编码模糊搜索
- 表格：角色名称、编码、描述、状态、创建时间
- 对话框：基本信息 + 权限分配（按 resource 分组的 checkbox）+ 菜单分配（el-tree show-checkbox）

**权限分组**：调入 `getAllPermissions()` 获取按 resource 分组的数据，每个分组渲染为独立的 `el-checkbox-group`，分组标题显示资源名

**菜单分配**：使用 `el-tree` 组件 + `show-checkbox`，通过 `@check` 事件同步 `form.menuIds`

### 4.4 权限管理页 (Permissions.vue)

**页面功能**：
- 搜索栏：名称/编码/资源模糊搜索
- 表格：名称、编码、资源(el-tag)、操作(el-tag)、描述、创建时间
- 对话框：resource 下拉预设（user/role/permission/menu/task/file/analysis/llm/rag + 自定义输入）、action 下拉预设（view/create/edit/delete/manage + 自定义输入）

### 4.5 菜单管理页 (Menus.vue)

**页面功能**：
- 表格：树形展示（`el-table` + `tree-props="{ children: 'children' }"` + `default-expand-all`）
- 列：名称、路径、图标、组件、排序、可见状态
- 对话框：名称、路径、图标、组件路径、上级菜单（`el-tree-select` 选择，编辑时过滤自身及后代）、排序、是否隐藏
- 操作列：编辑、删除、新增子项

**树形构建**：
- 从平铺列表通过 `buildTree()` 函数递归构建嵌套结构
- 编辑时的上级菜单选择器通过 `menuTreeForSelect` computed 过滤掉自身及其所有后代节点

### 4.6 前端代码模式

统一遵循项目中 `LLMSettings.vue` + `files/Index.vue` 模式：
- `script setup lang="ts"` + Composition API
- `reactive()` 用于搜索表单，`ref()` 用于列表和状态
- `ElMessage` / `ElMessageBox` 反馈
- `destroy-on-close` 对话框
- `editingId` ref 区分新增/编辑模式
- `fixed="right"` 操作列

## 五、技术栈

| 层 | 技术 |
|----|------|
| 数据库 | PostgreSQL（liangwenqing schema） |
| 后端框架 | Express.js + TypeScript |
| 数据库访问 | `db.prepare()` 封装（自动 camelCase + `?`→`$1` 占位符转换） |
| 密码哈希 | bcryptjs (SALT_ROUNDS=10) |
| 前端框架 | Vue 3 + TypeScript + Composition API |
| UI 组件 | Element Plus (el-table, el-dialog, el-form, el-tree, el-tree-select 等) |
| HTTP 客户端 | Axios（自动 token 注入 + 刷新） |

## 六、后续扩展建议

1. **种子数据**：首次部署时预置 admin 角色 + 基础权限 + 现有侧边栏菜单项
2. **权限校验中间件**：创建 `middleware/rbac.ts`，在路由层根据用户角色+权限拦截请求
3. **前端路由守卫增强**：根据用户菜单权限动态生成路由和侧边栏
4. **OAuth2 用户同步**：当 OAuth2 登录用户不存在时自动插入 `sp_users` 记录（`oauth2_user_id` 关联）
5. **操作日志**：记录用户的创建/编辑/删除操作到 `sp_audit_logs` 表
