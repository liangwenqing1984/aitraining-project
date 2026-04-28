import { Pool } from 'pg';
import path from 'path';

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

// 🔧 添加连接池监控日志
pool.on('connect', () => {
  console.log(`[DB Pool] 新连接建立，当前活跃连接数: ${pool.totalCount - pool.idleCount}/${20}`);
});

pool.on('remove', () => {
  console.log(`[DB Pool] 连接移除，当前总连接数: ${pool.totalCount}`);
});

pool.on('error', (err) => {
  console.error('[DB Pool] 连接池错误:', err.message);
});

// 初始化数据库表
async function initDatabase() {
  const client = await pool.connect();
  
  try {
    // 先启用 pgvector 扩展（在设置 schema 之前，扩展安装在 public schema）
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');

    // 设置schema搜索路径（包含 public 以便访问 vector 类型）
    await client.query('SET search_path TO liangwenqing, public');
    
    // 创建tasks表
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
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
      AND table_name = 'tasks' 
      AND column_name = 'error_message'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('[Database] 添加error_message字段到tasks表...');
      await client.query(`
        ALTER TABLE tasks ADD COLUMN error_message TEXT
      `);
      console.log('[Database] ✅ error_message字段添加成功');
    } else {
      console.log('[Database] ✅ error_message字段已存在');
    }

    // 创建csv_files表
    await client.query(`
      CREATE TABLE IF NOT EXISTS csv_files (
        id VARCHAR(255) PRIMARY KEY,
        task_id VARCHAR(255) REFERENCES tasks(id) ON DELETE CASCADE,
        filename VARCHAR(500) NOT NULL,
        filepath TEXT NOT NULL,
        file_size BIGINT NOT NULL,
        record_count INTEGER NOT NULL,
        source VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建 llm_config 表
    await client.query(`
      CREATE TABLE IF NOT EXISTS llm_config (
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

    // 创建 job_enrichments 表（LLM数据增强结果）
    await client.query(`
      CREATE TABLE IF NOT EXISTS job_enrichments (
        id VARCHAR(255) PRIMARY KEY,
        task_id VARCHAR(255) REFERENCES tasks(id) ON DELETE CASCADE,
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

    // 创建 market_reports 表（LLM 市场洞察报告）
    await client.query(`
      CREATE TABLE IF NOT EXISTS market_reports (
        id VARCHAR(255) PRIMARY KEY,
        file_id VARCHAR(255) REFERENCES csv_files(id) ON DELETE CASCADE,
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

    // 创建 saved_queries 表（自然语言查询历史）
    await client.query(`
      CREATE TABLE IF NOT EXISTS saved_queries (
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

    // 创建 job_embeddings 表（RAG 职位向量存储，依赖 pgvector 扩展）
    await client.query(`
      CREATE TABLE IF NOT EXISTS job_embeddings (
        id VARCHAR(255) PRIMARY KEY,
        job_id VARCHAR(255) NOT NULL,
        task_id VARCHAR(255) REFERENCES tasks(id) ON DELETE CASCADE,
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

    // 创建索引
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_csv_files_task_id ON csv_files(task_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_csv_files_source ON csv_files(source)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_llm_config_active ON llm_config(is_active)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_job_enrichments_task ON job_enrichments(task_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_market_reports_file ON market_reports(file_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_saved_queries_task ON saved_queries(task_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_job_embeddings_task ON job_embeddings(task_id)');
    // pgvector IVFFlat 索引（加速近似最近邻搜索）
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_job_embeddings_vector
      ON job_embeddings USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `).catch(() => {
      // IVFFlat 索引在空表上创建可能失败，插入数据后重建即可
      console.log('[Database] ⚠️ IVFFlat 索引创建跳过（可能因表为空），后续可通过 reindex 手动重建');
    });

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