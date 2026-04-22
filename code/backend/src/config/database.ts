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
    // 设置schema搜索路径
    await client.query('SET search_path TO liangwenqing');
    
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

    // 创建索引
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_csv_files_task_id ON csv_files(task_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_csv_files_source ON csv_files(source)');

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
            await client.query('SET search_path TO liangwenqing');
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
            await client.query('SET search_path TO liangwenqing');
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
            await client.query('SET search_path TO liangwenqing');
            
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