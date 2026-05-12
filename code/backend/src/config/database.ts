import { Pool, types } from 'pg';
import path from 'path';

// 重写 pg TIMESTAMP 解析器：返回纯字符串，避免 Date 对象序列化时附加时区
// PostgreSQL 返回格式 "2026-05-08 11:12:54.095"，去掉毫秒以保持简洁
types.setTypeParser(1114, (value: string) => {
  // TIMESTAMP (OID 1114) — 截掉 .123 毫秒部分，格式: "2026-05-08 11:12:54"
  return value.replace(/\.\d+$/, '');
});
types.setTypeParser(1184, (value: string) => {
  // TIMESTAMPTZ (OID 1184) — 同样处理，去掉 +08 时区后缀和毫秒
  return value.replace(/\.\d+.*$/, '');
});

// PostgreSQL连接配置
const pool = new Pool({
  host: '10.1.1.113',
  port: 7300,
  database: 'training_exercises',
  user: 'liangwenqing',
  password: 'liangwenqing',
  max: 50, // 🔧 增加连接池最大连接数，从20提升到50，支持高并发爬虫任务
  idleTimeoutMillis: 30000, // 空闲连接超时时间
  connectionTimeoutMillis: 5000, // 🔧 增加连接超时时间，从2秒提升到5秒
});

// 🔧 添加连接池监控日志 + 北京时区设置
pool.on('connect', (client) => {
  client.query("SET timezone = 'Asia/Shanghai'").catch(err => console.error('[DB Pool] 设置时区失败:', err.message));
  console.log(`[DB Pool] 新连接建立，当前活跃连接数: ${pool.totalCount - pool.idleCount}/50`);
});

pool.on('remove', () => {
  console.log(`[DB Pool] 连接移除，当前总连接数: ${pool.totalCount}`);
});

pool.on('error', (err) => {
  console.error('[DB Pool] 连接池错误:', err.message);
});

// pgvector 扩展是否可用（由 initDatabase 检测）
export let pgvectorAvailable = false;

// 初始化数据库表
async function initDatabase() {
  const client = await pool.connect();

  try {
    // 先启用 pgvector 扩展（在设置 schema 之前，扩展安装在 liangwenqing schema）
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    pgvectorAvailable = true;
    console.log('[Database] ✅ pgvector 扩展已就绪');
  } catch (e: any) {
    pgvectorAvailable = false;
    console.warn('[Database] ⚠️ pgvector 扩展不可用，RAG 语义搜索功能将禁用:', e.message);
    console.warn('[Database] 安装方法: 在 PostgreSQL 服务器上执行: apt install postgresql-16-pgvector');
  }

  // 设置schema搜索路径（包含 liangwenqing 以便访问 vector 类型）
  await client.query('SET search_path TO liangwenqing, public');
  // 设置北京时区，所有 CURRENT_TIMESTAMP / NOW() 返回北京时间，不带时区后缀
  await client.query("SET timezone = 'Asia/Shanghai'");

  try {
    // 创建tasks表
    await client.query(`
      CREATE TABLE IF NOT EXISTS sp_tasks (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(500) NOT NULL,
        source VARCHAR(50) NOT NULL,
        config JSONB NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        total INTEGER DEFAULT 0,
        current INTEGER DEFAULT 0,
        record_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        error_message TEXT,
        csv_path TEXT,
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 检查并添加error_message字段（如果不存在）
    const columnCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'liangwenqing' 
      AND table_name = 'sp_tasks' 
      AND column_name = 'error_message'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('[Database] 添加error_message字段到tasks表...');
      try {
        await client.query('ALTER TABLE sp_tasks ADD COLUMN error_message TEXT');
        console.log('[Database] ✅ error_message字段添加成功');
      } catch (alterErr: any) {
        // 并发场景下列可能已被其他连接添加
        if (alterErr.code === '42701') {
          console.log('[Database] ℹ️ error_message字段已存在（由并行初始化创建）');
        } else {
          throw alterErr;
        }
      }
    } else {
      console.log('[Database] ✅ error_message字段已存在');
    }

    // 创建csv_files表
    await client.query(`
      CREATE TABLE IF NOT EXISTS sp_csv_files (
        id VARCHAR(255) PRIMARY KEY,
        task_id VARCHAR(255) REFERENCES sp_tasks(id) ON DELETE CASCADE,
        filename VARCHAR(500) NOT NULL,
        filepath TEXT NOT NULL,
        file_size BIGINT NOT NULL,
        record_count INTEGER NOT NULL,
        source VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建 sp_llm_config 表
    await client.query(`
      CREATE TABLE IF NOT EXISTS sp_llm_config (
        id SERIAL PRIMARY KEY,
        provider VARCHAR(50) NOT NULL,
        model_name VARCHAR(100) NOT NULL,
        api_key_encrypted TEXT,
        base_url VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        task_routing JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建 sp_job_enrichments 表（LLM数据增强结果）
    await client.query(`
      CREATE TABLE IF NOT EXISTS sp_job_enrichments (
        id VARCHAR(255) PRIMARY KEY,
        task_id VARCHAR(255) REFERENCES sp_tasks(id) ON DELETE CASCADE,
        job_id VARCHAR(255) NOT NULL,
        salary_monthly_min INTEGER,
        salary_monthly_max INTEGER,
        salary_annual_estimate INTEGER,
        job_category_l1 VARCHAR(100),
        job_category_l2 VARCHAR(100),
        company_industry VARCHAR(100),
        key_skills JSONB DEFAULT '[]',
        required_skills JSONB DEFAULT '[]',
        preferred_skills JSONB DEFAULT '[]',
        education_normalized VARCHAR(20),
        experience_years_min INTEGER,
        experience_years_max INTEGER,
        benefits JSONB DEFAULT '[]',
        work_mode VARCHAR(20),
        model_used VARCHAR(100),
        enriched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(task_id, job_id)
      )
    `);

    // 创建 sp_market_reports 表（LLM 市场洞察报告）
    await client.query(`
      CREATE TABLE IF NOT EXISTS sp_market_reports (
        id VARCHAR(255) PRIMARY KEY,
        file_id VARCHAR(255) REFERENCES sp_csv_files(id) ON DELETE CASCADE,
        task_id VARCHAR(255),
        report_type VARCHAR(50) DEFAULT 'overview',
        title VARCHAR(500),
        content TEXT,
        summary TEXT,
        charts_config JSONB DEFAULT '[]',
        model_used VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 移除 file_id 外键约束，支持全量报告（file_id='__all__' 不引用具体文件）
    await client.query(`
      ALTER TABLE sp_market_reports DROP CONSTRAINT IF EXISTS market_reports_file_id_fkey
    `).catch(() => { /* 约束可能不存在 */ });

    // 创建 sp_saved_queries 表（自然语言查询历史）
    // 创建 sp_jobs 表（原始职位数据，与 Excel 同步入库）
    await client.query(`
      CREATE TABLE IF NOT EXISTS sp_jobs (
        id VARCHAR(255) PRIMARY KEY,
        task_id VARCHAR(255) REFERENCES sp_tasks(id) ON DELETE CASCADE,
        job_id VARCHAR(255) NOT NULL,
        data_source VARCHAR(50) NOT NULL,
        company_name VARCHAR(500),
        job_name VARCHAR(500),
        work_city VARCHAR(100),
        salary_range VARCHAR(100),
        education VARCHAR(50),
        work_experience VARCHAR(100),
        job_category VARCHAR(200),
        raw_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(task_id, job_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sp_saved_queries (
        id VARCHAR(255) PRIMARY KEY,
        task_id VARCHAR(255),
        user_query TEXT NOT NULL,
        generated_sql TEXT,
        result_summary TEXT,
        result_data JSONB DEFAULT '[]',
        result_count INTEGER DEFAULT 0,
        model_used VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建 sp_job_embeddings 表（RAG 职位向量存储，依赖 pgvector 扩展）
    if (pgvectorAvailable) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS sp_job_embeddings (
          id VARCHAR(255) PRIMARY KEY,
          job_id VARCHAR(255) NOT NULL,
          task_id VARCHAR(255) REFERENCES sp_tasks(id) ON DELETE CASCADE,
          text_content TEXT NOT NULL,
          embedding vector(768),
          job_name VARCHAR(500),
          job_category_l1 VARCHAR(100),
          job_category_l2 VARCHAR(100),
          company_name VARCHAR(500),
          company_industry VARCHAR(100),
          work_city VARCHAR(100),
          salary_monthly_min INTEGER,
          salary_monthly_max INTEGER,
          key_skills JSONB DEFAULT '[]',
          source_metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(task_id, job_id)
        )
      `);
    } else {
      console.warn('[Database] ⚠️ 跳过 sp_job_embeddings 表创建（pgvector 不可用）');
    }

    // ==================== 系统管理 RBAC 表 ====================

    // 用户表
    await client.query(`
      CREATE TABLE IF NOT EXISTS sp_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255),
        real_name VARCHAR(100) NOT NULL,
        email VARCHAR(200),
        phone VARCHAR(50),
        oauth2_user_id VARCHAR(255),
        status BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 角色表
    await client.query(`
      CREATE TABLE IF NOT EXISTS sp_roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(100) NOT NULL UNIQUE,
        description VARCHAR(500),
        status BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 权限表
    await client.query(`
      CREATE TABLE IF NOT EXISTS sp_permissions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(100) NOT NULL UNIQUE,
        resource VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        description VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 菜单表（自引用树形结构）
    await client.query(`
      CREATE TABLE IF NOT EXISTS sp_menus (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        path VARCHAR(255),
        icon VARCHAR(100),
        parent_id INT REFERENCES sp_menus(id) ON DELETE SET NULL,
        sort_order INT DEFAULT 0,
        component VARCHAR(255),
        hidden BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 用户-角色关联表
    await client.query(`
      CREATE TABLE IF NOT EXISTS sp_user_roles (
        user_id INT REFERENCES sp_users(id) ON DELETE CASCADE,
        role_id INT REFERENCES sp_roles(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, role_id)
      )
    `);

    // 角色-权限关联表
    await client.query(`
      CREATE TABLE IF NOT EXISTS sp_role_permissions (
        role_id INT REFERENCES sp_roles(id) ON DELETE CASCADE,
        permission_id INT REFERENCES sp_permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
      )
    `);

    // 角色-菜单关联表
    await client.query(`
      CREATE TABLE IF NOT EXISTS sp_role_menus (
        role_id INT REFERENCES sp_roles(id) ON DELETE CASCADE,
        menu_id INT REFERENCES sp_menus(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, menu_id)
      )
    `);

    // ==================== 问答机器人表 ====================

    // 文档向量表（存储帮助文档的向量化片段）
    if (pgvectorAvailable) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS sp_doc_embeddings (
          id SERIAL PRIMARY KEY,
          section_id VARCHAR(100) NOT NULL,
          section_title VARCHAR(200),
          chunk_index INT DEFAULT 0,
          text_content TEXT NOT NULL,
          embedding vector(768),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(section_id, chunk_index)
        )
      `);
    }

    // 聊天会话表
    await client.query(`
      CREATE TABLE IF NOT EXISTS sp_chat_sessions (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) DEFAULT '新对话',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 聊天消息表
    await client.query(`
      CREATE TABLE IF NOT EXISTS sp_chat_messages (
        id SERIAL PRIMARY KEY,
        session_id INT REFERENCES sp_chat_sessions(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        sources JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建索引
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_status ON sp_tasks(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON sp_tasks(created_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_csv_files_task_id ON sp_csv_files(task_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_csv_files_source ON sp_csv_files(source)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_jobs_task_id ON sp_jobs(task_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_jobs_data_source ON sp_jobs(data_source)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_llm_config_active ON sp_llm_config(is_active)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_job_enrichments_task ON sp_job_enrichments(task_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_market_reports_file ON sp_market_reports(file_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_saved_queries_task ON sp_saved_queries(task_id)');
    // RBAC 索引
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_username ON sp_users(username)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_status ON sp_users(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_roles_code ON sp_roles(code)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_permissions_code ON sp_permissions(code)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_menus_parent_id ON sp_menus(parent_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_menus_sort_order ON sp_menus(sort_order)');
    // 问答机器人索引
    await client.query('CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON sp_chat_messages(session_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON sp_chat_messages(created_at)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON sp_chat_sessions(updated_at DESC)');
    if (pgvectorAvailable) {
      await client.query('CREATE INDEX IF NOT EXISTS idx_doc_embeddings_section ON sp_doc_embeddings(section_id)');
    }
    if (pgvectorAvailable) {
      await client.query('CREATE INDEX IF NOT EXISTS idx_job_embeddings_task ON sp_job_embeddings(task_id)');
      // pgvector IVFFlat 索引（加速近似最近邻搜索）
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_job_embeddings_vector
        ON sp_job_embeddings USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `).catch(() => {
        // IVFFlat 索引在空表上创建可能失败，插入数据后重建即可
        console.log('[Database] ⚠️ IVFFlat 索引创建跳过（可能因表为空），后续可通过 reindex 手动重建');
      });
    }

    console.log('✅ PostgreSQL数据库表初始化完成');
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  } finally {
    client.release();
  }
}

// 将数据库返回的下划线命名转换为驼峰命名
function convertToCamelCase(row: any): any {
  if (!row || typeof row !== 'object') return row;
  
  const converted: any = {};
  for (const key in row) {
    if (row.hasOwnProperty(key)) {
      // 将下划线命名转换为驼峰命名
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      converted[camelKey] = row[key];
    }
  }
  return converted;
}

// 将数组中的所有对象转换为驼峰命名
function convertRowsToCamelCase(rows: any[]): any[] {
  return rows.map(row => convertToCamelCase(row));
}

// 将SQLite风格的?占位符转换为PostgreSQL的$1, $2风格
function convertSqlPlaceholders(sql: string): string {
  let placeholderIndex = 0;
  return sql.replace(/\?/g, () => {
    placeholderIndex++;
    return `$${placeholderIndex}`;
  });
}

// 数据库操作封装
const db = {
  prepare(sql: string) {
    // 转换占位符格式
    const convertedSql = convertSqlPlaceholders(sql);
    
    return {
      async all(...args: any[]) {
        try {
          const client = await pool.connect();
          try {
            await client.query('SET search_path TO liangwenqing, public');
            const result = await client.query(convertedSql, args);
            
            // 🔧 调试日志：记录原始结果
            console.log('[DB] Query result:', {
              rowCount: result.rowCount,
              rowsType: Array.isArray(result.rows) ? 'array' : typeof result.rows,
              rowsLength: result.rows?.length,
              sql: convertedSql.substring(0, 100)
            });
            
            const converted = convertRowsToCamelCase(result.rows);
            
            // 🔧 调试日志：记录转换后的结果
            console.log('[DB] Converted result:', {
              type: Array.isArray(converted) ? 'array' : typeof converted,
              length: Array.isArray(converted) ? converted.length : 'N/A'
            });
            
            return converted;
          } finally {
            client.release();
          }
        } catch (error) {
          console.error('[DB] Query all error:', error);
          throw error;
        }
      },
      
      async get(...args: any[]) {
        try {
          const client = await pool.connect();
          try {
            await client.query('SET search_path TO liangwenqing, public');
            const result = await client.query(convertedSql, args);
            return result.rows[0] ? convertToCamelCase(result.rows[0]) : null;
          } finally {
            client.release();
          }
        } catch (error) {
          console.error('[DB] Query get error:', error);
          throw error;
        }
      },
      
      async run(...args: any[]) {
        try {
          const client = await pool.connect();
          try {
            await client.query('SET search_path TO liangwenqing, public');
            
            // 处理INSERT和UPDATE语句中的datetime('now')
            let processedSql = convertedSql.replace(/datetime\('now'\)/g, 'CURRENT_TIMESTAMP');
            
            const result = await client.query(processedSql, args);
            return {
              lastID: result.rows[0]?.id,
              changes: result.rowCount || 0
            };
          } finally {
            client.release();
          }
        } catch (error) {
          console.error('[DB] Run error:', error);
          throw error;
        }
      }
    };
  }
};

export { db, initDatabase, pool };