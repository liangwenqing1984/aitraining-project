/**
 * 菜单迁移：新建"场景应用 > HR助手"，将简历筛选/简历库/内部岗位移到其下
 * 用法: npx ts-node scripts/migrateMenuHR.ts
 */
import { Pool } from 'pg';

const pool = new Pool({
  host: '10.1.1.113',
  port: 7300,
  database: 'training_exercises',
  user: 'liangwenqing',
  password: 'liangwenqing',
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. 检查是否已迁移
    const exists = await client.query(`SELECT id FROM sp_menus WHERE name = '场景应用'`);
    if (exists.rows.length > 0) {
      console.log('[Migration] 场景应用菜单已存在，跳过迁移');
      await client.query('ROLLBACK');
      return;
    }

    // 2. 调整 sort_order：语义搜索 8→9, 模型管理 9→10, 系统管理 10→11, 系统帮助 11→12, 关于 12→13
    console.log('[Migration] 调整已有菜单 sort_order...');
    await client.query(`UPDATE sp_menus SET sort_order = 9  WHERE name = '语义搜索' AND sort_order = 8`);
    await client.query(`UPDATE sp_menus SET sort_order = 10 WHERE name = '模型管理' AND sort_order = 9`);
    await client.query(`UPDATE sp_menus SET sort_order = 11 WHERE name = '系统管理' AND sort_order = 10`);
    await client.query(`UPDATE sp_menus SET sort_order = 12 WHERE name = '系统帮助' AND sort_order = 11`);
    await client.query(`UPDATE sp_menus SET sort_order = 13 WHERE name = '关于' AND sort_order = 12`);

    // 3. 创建 场景应用 父菜单 (sort=8)
    const sceneResult = await client.query(
      `INSERT INTO sp_menus (name, icon, sort_order, hidden, created_at, updated_at)
       VALUES ('场景应用', 'Monitor', 8, false, NOW(), NOW()) RETURNING id`
    );
    const sceneId = sceneResult.rows[0].id;
    console.log(`[Migration] 场景应用 创建成功 id=${sceneId}`);

    // 4. 创建 HR助手 子菜单 (parentId=sceneId)
    const hrResult = await client.query(
      `INSERT INTO sp_menus (name, icon, parent_id, sort_order, hidden, created_at, updated_at)
       VALUES ('HR助手', 'UserFilled', $1, 1, false, NOW(), NOW()) RETURNING id`,
      [sceneId]
    );
    const hrId = hrResult.rows[0].id;
    console.log(`[Migration] HR助手 创建成功 id=${hrId}`);

    // 5. 移动三个菜单到 HR助手 下
    const moveQueries = [
      { name: '简历筛选', path: '/rag/resume', sort: 1 },
      { name: '简历库', path: '/rag/resume-library', sort: 2 },
      { name: '内部岗位', path: '/system/internal-jobs', sort: 3 },
    ];
    for (const m of moveQueries) {
      const result = await client.query(
        `UPDATE sp_menus SET parent_id = $1, sort_order = $2, updated_at = NOW()
         WHERE path = $3 AND name = $4 RETURNING id`,
        [hrId, m.sort, m.path, m.name]
      );
      if (result.rows.length > 0) {
        console.log(`[Migration] ${m.name} → HR助手 (id=${result.rows[0].id})`);
      } else {
        console.warn(`[Migration] ⚠ ${m.name} (path=${m.path}) 未找到，跳过`);
      }
    }

    // 6. 为新菜单分配权限给 admin 角色
    const adminRole = await client.query(`SELECT id FROM sp_roles WHERE code = 'admin'`);
    if (adminRole.rows.length > 0) {
      const roleId = adminRole.rows[0].id;
      await client.query(
        `INSERT INTO sp_role_menus (role_id, menu_id) VALUES ($1, $2), ($1, $3) ON CONFLICT DO NOTHING`,
        [roleId, sceneId, hrId]
      );
      console.log(`[Migration] 管理员角色已绑定新菜单`);
    }

    await client.query('COMMIT');
    console.log('[Migration] ✅ 菜单迁移完成');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[Migration] ❌ 迁移失败:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(() => process.exit(1));
