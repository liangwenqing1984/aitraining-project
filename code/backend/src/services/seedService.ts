import { db } from '../config/database';
import * as userService from './userService';
import * as roleService from './roleService';
import * as permissionService from './permissionService';
import * as menuService from './menuService';

export async function runSeed(): Promise<void> {
  console.log('[Seed] 开始检查种子数据...');

  // 检查是否已初始化（菜单表有数据即跳过）
  const menuCount = await db.prepare('SELECT COUNT(*) as cnt FROM sp_menus').get() as any;
  if (menuCount?.cnt > 0) {
    console.log('[Seed] 种子数据已存在，跳过初始化');
    return;
  }

  console.log('[Seed] 首次启动，初始化种子数据...');

  try {
    // Step 1: 创建权限
    const permissions = [
      { name: '查看用户', code: 'user:view', resource: 'user', action: 'view', description: '查看用户列表和详情' },
      { name: '创建用户', code: 'user:create', resource: 'user', action: 'create', description: '创建新用户' },
      { name: '编辑用户', code: 'user:edit', resource: 'user', action: 'edit', description: '编辑用户信息' },
      { name: '删除用户', code: 'user:delete', resource: 'user', action: 'delete', description: '删除用户' },
      { name: '查看角色', code: 'role:view', resource: 'role', action: 'view', description: '查看角色列表和详情' },
      { name: '创建角色', code: 'role:create', resource: 'role', action: 'create', description: '创建新角色' },
      { name: '编辑角色', code: 'role:edit', resource: 'role', action: 'edit', description: '编辑角色信息' },
      { name: '删除角色', code: 'role:delete', resource: 'role', action: 'delete', description: '删除角色' },
      { name: '查看权限', code: 'permission:view', resource: 'permission', action: 'view', description: '查看权限列表' },
      { name: '创建权限', code: 'permission:create', resource: 'permission', action: 'create', description: '创建新权限' },
      { name: '编辑权限', code: 'permission:edit', resource: 'permission', action: 'edit', description: '编辑权限' },
      { name: '删除权限', code: 'permission:delete', resource: 'permission', action: 'delete', description: '删除权限' },
      { name: '查看菜单', code: 'menu:view', resource: 'menu', action: 'view', description: '查看菜单结构' },
      { name: '创建菜单', code: 'menu:create', resource: 'menu', action: 'create', description: '创建新菜单' },
      { name: '编辑菜单', code: 'menu:edit', resource: 'menu', action: 'edit', description: '编辑菜单' },
      { name: '删除菜单', code: 'menu:delete', resource: 'menu', action: 'delete', description: '删除菜单' },
      { name: '查看任务', code: 'task:view', resource: 'task', action: 'view', description: '查看采集任务' },
      { name: '创建任务', code: 'task:create', resource: 'task', action: 'create', description: '创建采集任务' },
      { name: '编辑任务', code: 'task:edit', resource: 'task', action: 'edit', description: '编辑采集任务' },
      { name: '删除任务', code: 'task:delete', resource: 'task', action: 'delete', description: '删除采集任务' },
      { name: '查看文件', code: 'file:view', resource: 'file', action: 'view', description: '查看文件列表' },
      { name: '上传文件', code: 'file:upload', resource: 'file', action: 'upload', description: '上传文件' },
      { name: '删除文件', code: 'file:delete', resource: 'file', action: 'delete', description: '删除文件' },
      { name: '查看分析', code: 'analysis:view', resource: 'analysis', action: 'view', description: '查看分析结果' },
      { name: '执行分析', code: 'analysis:execute', resource: 'analysis', action: 'execute', description: '执行分析任务' },
      { name: '查看LLM配置', code: 'llm:view', resource: 'llm', action: 'view', description: '查看模型配置' },
      { name: '编辑LLM配置', code: 'llm:edit', resource: 'llm', action: 'edit', description: '修改模型配置' },
      { name: '使用RAG', code: 'rag:use', resource: 'rag', action: 'use', description: '使用语义搜索' },
      { name: '管理RAG', code: 'rag:manage', resource: 'rag', action: 'manage', description: '管理知识库' },
    ];

    const permissionIds: number[] = [];
    for (const p of permissions) {
      const perm = await permissionService.createPermission(p as any);
      permissionIds.push(perm.id!);
      console.log(`[Seed] 权限: ${p.name} (id=${perm.id})`);
    }

    // Step 2: 创建菜单
    const menus = [
      { name: '首页', path: '/home', icon: 'HomeFilled', sortOrder: 1 },
      { name: '数据采集', path: '/crawler', icon: 'Monitor', sortOrder: 2 },
      { name: '数据管理', path: '/files', icon: 'Files', sortOrder: 3 },
      { name: '智能分析', path: '/analysis', icon: 'TrendCharts', sortOrder: 4 },
      { name: '智能查询', path: '/query', icon: 'TrendCharts', sortOrder: 5 },
      { name: '语义搜索', path: '/rag', icon: 'Search', sortOrder: 6 },
      { name: '模型配置', path: '/settings/llm', icon: 'Setting', sortOrder: 7 },
    ];

    const menuIds: Record<string, number> = {};
    for (const m of menus) {
      const menu = await menuService.createMenu({
        name: m.name, path: m.path, icon: m.icon,
        sortOrder: m.sortOrder, hidden: false,
      } as any);
      menuIds[m.name] = menu.id!;
      console.log(`[Seed] 菜单: ${m.name} (id=${menu.id})`);
    }

    // Step 2: 创建系统管理父菜单 + 子菜单
    const sysMenu = await menuService.createMenu({
      name: '系统管理', icon: 'Setting', sortOrder: 8, hidden: false,
    } as any);
    console.log(`[Seed] 菜单: 系统管理 (id=${sysMenu.id})`);

    const sysChildren = [
      { name: '用户管理', path: '/system/users', sortOrder: 1 },
      { name: '角色管理', path: '/system/roles', sortOrder: 2 },
      { name: '权限管理', path: '/system/permissions', sortOrder: 3 },
      { name: '菜单管理', path: '/system/menus', sortOrder: 4 },
    ];
    const sysChildIds: number[] = [];
    for (const child of sysChildren) {
      const m = await menuService.createMenu({
        name: child.name, path: child.path, parentId: sysMenu.id,
        sortOrder: child.sortOrder, hidden: false,
      } as any);
      sysChildIds.push(m.id!);
      console.log(`[Seed]   子菜单: ${child.name} (id=${m.id})`);
    }

    // 剩余独立菜单
    await menuService.createMenu({
      name: '文档', path: '/docs', icon: 'Document', sortOrder: 9, hidden: false,
    } as any);
    await menuService.createMenu({
      name: '关于', path: '/about', icon: 'InfoFilled', sortOrder: 10, hidden: false,
    } as any);

    // Step 3: 创建管理员角色
    const allMenuIds = Object.values(menuIds);
    allMenuIds.push(sysMenu.id!, ...sysChildIds);
    // Also add docs and about (they're the last two menus)
    const lastMenus = await db.prepare('SELECT id FROM sp_menus ORDER BY id DESC LIMIT 2').all() as any[];
    for (const m of lastMenus) {
      if (!allMenuIds.includes(m.id)) allMenuIds.push(m.id);
    }

    const adminRole = await roleService.createRole({
      name: '系统管理员', code: 'admin', description: '系统最高权限角色，拥有所有菜单和功能访问权限',
      status: true, permissionIds, menuIds: allMenuIds,
    } as any);
    console.log(`[Seed] 角色: ${adminRole.name} (id=${adminRole.id})`);

    // Step 5: 创建管理员用户
    const adminUser = await userService.createUser({
      username: 'admin',
      password: 'Admin@admin123',
      realName: '系统管理员',
      email: 'admin@aitraining.local',
      status: true,
      roleIds: [adminRole.id!],
    } as any);
    console.log(`[Seed] 用户: ${adminUser.username} (id=${adminUser.id})`);

    console.log('[Seed] ✅ 种子数据初始化完成');
    console.log('[Seed] ┌─────────────────────────────────────────────┐');
    console.log('[Seed] │  管理员账号: admin                          │');
    console.log('[Seed] │  管理员密码: Admin@admin123                 │');
    console.log('[Seed] │  登录方式:   账号登录（本地登录）            │');
    console.log('[Seed] └─────────────────────────────────────────────┘');
  } catch (error: any) {
    console.error('[Seed] ❌ 种子数据初始化失败:', error.message);
    // 不抛出异常，避免阻塞服务启动
  }
}
