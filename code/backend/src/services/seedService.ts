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
    // Step 1: 创建菜单
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
      status: true, menuIds: allMenuIds,
    } as any);
    console.log(`[Seed] 角色: ${adminRole.name} (id=${adminRole.id})`);

    // Step 4: 创建管理员用户
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
