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

    // 创建 sp_resumes 表（简历结构化解析存储）
    if (pgvectorAvailable) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS sp_resumes (
          id SERIAL PRIMARY KEY,
          original_filename VARCHAR(500),
          file_hash VARCHAR(64),
          raw_text TEXT,
          name VARCHAR(100),
          email VARCHAR(200),
          phone VARCHAR(50),
          education_level VARCHAR(20),
          school VARCHAR(200),
          major VARCHAR(200),
          graduation_year INTEGER,
          work_years INTEGER,
          skills JSONB DEFAULT '[]',
          skill_levels JSONB DEFAULT '{}',
          desired_position VARCHAR(200),
          desired_city VARCHAR(100),
          desired_salary_min INTEGER,
          desired_salary_max INTEGER,
          job_type VARCHAR(20),
          projects JSONB DEFAULT '[]',
          certifications JSONB DEFAULT '[]',
          languages JSONB DEFAULT '[]',
          self_evaluation TEXT,
          parse_confidence REAL,
          parsed_by_model VARCHAR(100),
          embedding vector(768),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } else {
      await client.query(`
        CREATE TABLE IF NOT EXISTS sp_resumes (
          id SERIAL PRIMARY KEY,
          original_filename VARCHAR(500),
          file_hash VARCHAR(64),
          raw_text TEXT,
          name VARCHAR(100),
          email VARCHAR(200),
          phone VARCHAR(50),
          education_level VARCHAR(20),
          school VARCHAR(200),
          major VARCHAR(200),
          graduation_year INTEGER,
          work_years INTEGER,
          skills JSONB DEFAULT '[]',
          skill_levels JSONB DEFAULT '{}',
          desired_position VARCHAR(200),
          desired_city VARCHAR(100),
          desired_salary_min INTEGER,
          desired_salary_max INTEGER,
          job_type VARCHAR(20),
          projects JSONB DEFAULT '[]',
          certifications JSONB DEFAULT '[]',
          languages JSONB DEFAULT '[]',
          self_evaluation TEXT,
          parse_confidence REAL,
          parsed_by_model VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    // 迁移：sp_resumes 添加 file_hash 列和唯一索引
    try {
      await client.query('ALTER TABLE sp_resumes ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64)');
    } catch (e: any) {
      if (e.code !== '42701') console.warn('[Database] file_hash migration:', e.message);
    }
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_resumes_file_hash ON sp_resumes(file_hash)').catch(() => {});

    // 创建 sp_internal_jobs 表（HR 内部岗位 JD 管理）
    if (pgvectorAvailable) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS sp_internal_jobs (
          id SERIAL PRIMARY KEY,
          title VARCHAR(300) NOT NULL,
          department VARCHAR(200),
          description TEXT NOT NULL,
          requirement TEXT,
          education_required VARCHAR(20),
          experience_years_min INTEGER,
          experience_years_max INTEGER,
          required_skills JSONB DEFAULT '[]',
          preferred_skills JSONB DEFAULT '[]',
          skill_match_mode VARCHAR(10) DEFAULT 'any',
          city_preferred JSONB DEFAULT '[]',
          job_category VARCHAR(100),
          headcount INTEGER DEFAULT 1,
          salary_min INTEGER,
          salary_max INTEGER,
          job_type VARCHAR(20) DEFAULT '全职',
          status VARCHAR(20) DEFAULT 'open',
          embedding vector(768),
          embedding_text TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } else {
      await client.query(`
        CREATE TABLE IF NOT EXISTS sp_internal_jobs (
          id SERIAL PRIMARY KEY,
          title VARCHAR(300) NOT NULL,
          department VARCHAR(200),
          description TEXT NOT NULL,
          requirement TEXT,
          education_required VARCHAR(20),
          experience_years_min INTEGER,
          experience_years_max INTEGER,
          required_skills JSONB DEFAULT '[]',
          preferred_skills JSONB DEFAULT '[]',
          skill_match_mode VARCHAR(10) DEFAULT 'any',
          city_preferred JSONB DEFAULT '[]',
          job_category VARCHAR(100),
          headcount INTEGER DEFAULT 1,
          salary_min INTEGER,
          salary_max INTEGER,
          job_type VARCHAR(20) DEFAULT '全职',
          status VARCHAR(20) DEFAULT 'open',
          embedding_text TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    // 创建 sp_screening_results 表（简历筛选结果持久化）
    await client.query(`
      CREATE TABLE IF NOT EXISTS sp_screening_results (
        id SERIAL PRIMARY KEY,
        resume_id INTEGER REFERENCES sp_resumes(id) ON DELETE SET NULL,
        internal_job_id INTEGER REFERENCES sp_internal_jobs(id) ON DELETE SET NULL,
        resume_name VARCHAR(200),
        internal_job_title VARCHAR(300),
        department VARCHAR(200),
        total_score REAL,
        recommendation VARCHAR(20),
        hard_rules_passed BOOLEAN,
        education_passed BOOLEAN,
        experience_passed BOOLEAN,
        skills_passed BOOLEAN,
        similarity REAL,
        skill_bonus REAL,
        score_breakdown JSONB DEFAULT '{}',
        full_result JSONB DEFAULT '{}',
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_screening_results_resume ON sp_screening_results(resume_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_screening_results_job ON sp_screening_results(internal_job_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_screening_results_created ON sp_screening_results(created_at DESC)');
    // 唯一约束：相同简历+相同岗位只保留最新一条筛选结果
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_screening_resume_job'
        ) THEN
          ALTER TABLE sp_screening_results ADD CONSTRAINT uq_screening_resume_job UNIQUE (resume_id, internal_job_id);
        END IF;
      END $$;
    `).catch(() => {});

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

    // ==================== 提示词管理表 ====================

    await client.query(`
      CREATE TABLE IF NOT EXISTS sp_prompts (
        id SERIAL PRIMARY KEY,
        category VARCHAR(50) NOT NULL,
        prompt_type VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        variables JSONB DEFAULT '[]',
        description VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_prompts_category ON sp_prompts(category)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_prompts_active ON sp_prompts(category, prompt_type, is_active)');

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

      // 迁移：添加 source_type 和 file_path 列
      try {
        await client.query(`ALTER TABLE sp_doc_embeddings ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'doc_section'`);
      } catch (e: any) {
        if (e.code !== '42701') console.warn('[Database] source_type migration:', e.message);
      }
      try {
        await client.query(`ALTER TABLE sp_doc_embeddings ADD COLUMN IF NOT EXISTS file_path VARCHAR(1000)`);
      } catch (e: any) {
        if (e.code !== '42701') console.warn('[Database] file_path migration:', e.message);
      }
      // 回填历史数据的 source_type NULL → 'doc_section'
      try {
        await client.query(`UPDATE sp_doc_embeddings SET source_type = 'doc_section' WHERE source_type IS NULL`);
      } catch (e: any) {
        console.warn('[Database] source_type 回填失败:', e.message);
      }
    }

    // 训练任务表（语义模型微调）
    if (pgvectorAvailable) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS sp_training_jobs (
          id SERIAL PRIMARY KEY,
          name VARCHAR(200) NOT NULL,
          dataset_config JSONB NOT NULL,
          base_model VARCHAR(100) NOT NULL,
          params JSONB NOT NULL,
          status VARCHAR(20) DEFAULT 'pending',
          progress REAL DEFAULT 0,
          metrics JSONB,
          dataset_path TEXT,
          model_output_path TEXT,
          log TEXT,
          started_at TIMESTAMP,
          finished_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
      await client.query('CREATE INDEX IF NOT EXISTS idx_doc_embeddings_source_type ON sp_doc_embeddings(source_type)');
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

    // 种子菜单项：将现有"语义搜索"从叶子改为父菜单（清空 path），再新增子菜单
    await client.query(`
      UPDATE sp_menus SET path = NULL
      WHERE name = '语义搜索' AND parent_id IS NULL AND path IS NOT NULL
    `);
    await client.query(`
      INSERT INTO sp_menus (name, path, icon, parent_id, sort_order, component, hidden)
      SELECT '职位搜索', '/rag', 'Search', m.id, 1, NULL, false
      FROM sp_menus m WHERE m.name = '语义搜索' AND m.parent_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM sp_menus WHERE name = '职位搜索')
    `);
    await client.query(`
      INSERT INTO sp_menus (name, path, icon, parent_id, sort_order, component, hidden)
      SELECT '简历筛选', '/rag/resume', 'User', m.id, 2, NULL, false
      FROM sp_menus m WHERE m.name = '语义搜索' AND m.parent_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM sp_menus WHERE name = '简历筛选')
    `);
    await client.query(`
      INSERT INTO sp_menus (name, path, icon, parent_id, sort_order, component, hidden)
      SELECT '简历库', '/rag/resume-library', 'Collection', m.id, 3, NULL, false
      FROM sp_menus m WHERE m.name = '语义搜索' AND m.parent_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM sp_menus WHERE name = '简历库')
    `);

    // 种子菜单项：系统管理下新增"增强数据管理"和"文本向量管理"
    await client.query(`
      INSERT INTO sp_menus (name, path, icon, parent_id, sort_order, component, hidden)
      SELECT '增强数据管理', '/system/enrichment', 'DataAnalysis', m.id, 5, NULL, false
      FROM sp_menus m WHERE m.name = '系统管理' AND m.parent_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM sp_menus WHERE name = '增强数据管理')
    `);
    await client.query(`
      INSERT INTO sp_menus (name, path, icon, parent_id, sort_order, component, hidden)
      SELECT '文本向量管理', '/system/vectors', 'Search', m.id, 6, NULL, false
      FROM sp_menus m WHERE m.name = '系统管理' AND m.parent_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM sp_menus WHERE name = '文本向量管理')
    `);
    // 种子菜单项：创建"模型管理"父菜单，并将"模型训练"和"模型配置"迁入
    await client.query(`
      INSERT INTO sp_menus (name, path, icon, parent_id, sort_order, component, hidden)
      SELECT '模型管理', NULL, 'TrendCharts', NULL, 9, NULL, false
      WHERE NOT EXISTS (SELECT 1 FROM sp_menus WHERE name = '模型管理' AND parent_id IS NULL)
    `);
    // 将"模型训练"迁入模型管理
    await client.query(`
      UPDATE sp_menus
      SET parent_id = (SELECT id FROM sp_menus WHERE name = '模型管理' AND parent_id IS NULL),
          sort_order = 1
      WHERE name = '模型训练'
      AND parent_id IS NOT NULL
      AND parent_id = (SELECT id FROM sp_menus WHERE name = '系统管理' AND parent_id IS NULL)
    `);
    // 将"模型配置"迁入模型管理
    await client.query(`
      UPDATE sp_menus
      SET parent_id = (SELECT id FROM sp_menus WHERE name = '模型管理' AND parent_id IS NULL),
          sort_order = 2
      WHERE name = '模型配置'
      AND parent_id IS NOT NULL
      AND parent_id = (SELECT id FROM sp_menus WHERE name = '系统管理' AND parent_id IS NULL)
    `);
    // 顺延 sort_order: 系统管理 9→10, 系统帮助 10→11, 关于 11→12
    await client.query(`
      UPDATE sp_menus SET sort_order = 10
      WHERE name = '系统管理' AND parent_id IS NULL AND sort_order = 9
    `);
    await client.query(`
      UPDATE sp_menus SET sort_order = 11
      WHERE name = '系统帮助' AND parent_id IS NULL AND sort_order = 10
    `);
    await client.query(`
      UPDATE sp_menus SET sort_order = 12
      WHERE name = '关于' AND parent_id IS NULL AND sort_order = 11
    `);
    // 将新父菜单"模型管理"授权给已有角色（拥有子菜单的角色同步获得父菜单权限）
    await client.query(`
      INSERT INTO sp_role_menus (role_id, menu_id)
      SELECT DISTINCT rm.role_id, pm.id
      FROM sp_role_menus rm
      CROSS JOIN sp_menus pm
      WHERE pm.name = '模型管理' AND pm.parent_id IS NULL
      AND rm.menu_id IN (SELECT id FROM sp_menus WHERE name IN ('模型训练', '模型配置'))
      AND NOT EXISTS (
        SELECT 1 FROM sp_role_menus rm2
        WHERE rm2.role_id = rm.role_id AND rm2.menu_id = pm.id
      )
    `);

    // 种子菜单项：系统管理下新增"内部岗位"
    await client.query(`
      INSERT INTO sp_menus (name, path, icon, parent_id, sort_order, component, hidden)
      SELECT '内部岗位', '/system/internal-jobs', 'Briefcase', m.id, 7, NULL, false
      FROM sp_menus m WHERE m.name = '系统管理' AND m.parent_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM sp_menus WHERE name = '内部岗位')
    `);

    // ==================== 种子提示词数据 ====================

    const seedPrompts: Array<{ category: string; promptType: string; name: string; content: string; variables: string[] }> = [
      // ===== ENRICHMENT =====
      {
        category: 'enrichment', promptType: 'system', name: '数据增强系统提示词',
        content: `你是一个招聘数据标准化专家。你的任务是将原始的招聘信息转换为结构化数据。

规则：
1. 薪资标准化：将"10K-15K"或"1万-1.5万/月"等格式转换为月薪的数值（单位：元）。如果无法确定，返回null。
2. 职位分类：
   - L1（一级）：技术、产品、运营、市场、销售、设计、金融、人力资源、行政、客服、物流、教育、医疗、建筑、制造、其他
   - L2（二级）：更细分，如 后端开发、前端开发、数据分析、测试、产品经理、UI设计 等
3. 公司行业分类：根据企业名称、经营范围、职位标签综合判断。选项：互联网、金融、教育、医疗、制造、房地产、零售、物流、能源、媒体、咨询、IT服务、建筑、其他
4. 技能提取：从职位描述和职位标签中提取技术关键词。key_skills 列出所有技能，required_skills 列出必备技能，preferred_skills 列出加分技能（如"优先"、"加分"等字样修饰的）
5. 学历标准化：将"本科及以上"、"大专"等规范化为 博士/硕士/本科/大专/高中/不限
6. 福利提取：从职位描述中提取：五险一金、年终奖、带薪年假、双休、餐补、交通补贴、住房补贴、股票期权、弹性工作 等
7. 工作模式：根据工作地址、工作性质判断。含"远程"→远程，含"驻场"→现场，无明确说明→现场（默认）

重要提示：
- 公司行业：优先从经营范围推断，其次从企业名称（如XX科技→IT服务，XX食品→制造），再结合职位类别
- 工作模式：大多数传统企业职位默认为"现场"，只有明确提到远程/混合才标记
- 尽可能推断，减少不必要的null值

请严格按照以下JSON格式输出，不要输出其他内容：
{
  "salary_monthly_min": 数字或null,
  "salary_monthly_max": 数字或null,
  "salary_annual_estimate": 数字或null,
  "job_category_l1": "技术|产品|运营|..." 或 null,
  "job_category_l2": "后端开发|前端开发|..." 或 null,
  "company_industry": "互联网|金融|..." 或 null,
  "key_skills": ["技能1", "技能2"],
  "required_skills": ["必备技能1"],
  "preferred_skills": ["加分技能1"],
  "education_normalized": "本科|硕士|..." 或 null,
  "experience_years_min": 数字或null,
  "experience_years_max": 数字或null,
  "benefits": ["福利1", "福利2"],
  "work_mode": "远程|现场|混合" 或 null
}`,
        variables: [],
      },
      {
        category: 'enrichment', promptType: 'user', name: '数据增强用户提示词',
        content: `请分析以下职位信息并进行标准化：

企业名称：\${companyName}
职位名称：\${jobName}
职位分类：\${jobCategory}
薪资范围：\${salaryRange}
工作城市：\${workCity}
工作地址：\${workAddress}
工作经验：\${workExperience}
学历要求：\${education}
公司性质：\${companyNature}
公司规模：\${companyScale}
经营范围：\${businessScope}
职位标签：\${jobTags}
工作性质：\${workType}
职位描述：\${jobDescription}`,
        variables: ['companyName','jobName','jobCategory','salaryRange','workCity','workAddress','workExperience','education','companyNature','companyScale','businessScope','jobTags','workType','jobDescription'],
      },
      // ===== INSIGHTS =====
      {
        category: 'insights', promptType: 'system', name: '市场洞察系统提示词',
        content: `你是一个招聘市场分析专家。你的任务是基于爬取的招聘数据，生成专业的市场分析报告。

分析维度：
1. 薪资水平：整体分布、分位数、与城市/行业交叉分析
2. 技能需求：热门技能排行、技能组合趋势
3. 行业对比：不同行业的薪资和需求量对比
4. 城市对比：不同城市的岗位分布和薪资差异
5. 学历/经验要求：企业对应聘者的硬性要求分析
6. 关键发现和趋势

请用中文输出。格式要求：
- 使用Markdown格式
- 包含具体的数字和百分比
- 每个分析点配上关键洞察
- 如果数据不足以支撑某个结论，坦诚说明

输出JSON格式：
{
  "title": "报告标题",
  "summary": "200字以内的摘要",
  "sections": [
    {
      "heading": "章节标题（Markdown ## 格式）",
      "body": "章节正文（Markdown 格式，可包含表格、列表）",
      "key_insight": "本章节最重要的一个发现"
    }
  ],
  "charts_config": [
    {
      "title": "图表标题",
      "chart_type": "bar|pie|line|scatter",
      "echarts_option": { /* ECharts option 对象 */ }
    }
  ]
}`,
        variables: [],
      },
      {
        category: 'insights', promptType: 'user', name: '市场洞察用户提示词',
        content: `请基于以下招聘数据统计生成深度分析报告：

数据概览：
- 总职位数：\${totalJobs}
- 覆盖城市数：\${cityCount}
- 数据时间范围：\${dateRange}

薪资分布：
\${salaryDistribution}

城市分布（Top 10）：
\${cityDistribution}

学历分布：
\${educationDistribution}

经验要求分布：
\${experienceDistribution}

公司性质分布：
\${companyNatureDistribution}

热门职位（Top 10）：
\${topJobs}

热门技能：
\${topSkills}`,
        variables: ['totalJobs','cityCount','dateRange','salaryDistribution','cityDistribution','educationDistribution','experienceDistribution','companyNatureDistribution','topJobs','topSkills'],
      },
      // ===== NL_QUERY =====
      {
        category: 'query', promptType: 'system', name: 'NL查询系统提示词',
        content: `你是一个SQL查询助手。用户会用自然语言询问招聘数据的问题，你需要将其转换为PostgreSQL查询。

数据库表结构（schema: liangwenqing）：

=== sp_job_enrichments 表（核心：AI增强后的标准化职位数据）===
- id (VARCHAR), task_id (VARCHAR FK), job_id (VARCHAR UNIQUE)
- salary_monthly_min (INTEGER) — 月薪下限（元）
- salary_monthly_max (INTEGER) — 月薪上限（元）
- salary_annual_estimate (INTEGER) — 估算年薪（元）
- job_category_l1 (VARCHAR) — 一级分类：技术/产品/运营/市场/销售/设计/金融/人力资源/行政/客服/物流/教育/医疗/建筑/制造/其他
- job_category_l2 (VARCHAR) — 二级分类：后端开发/前端开发/数据分析/测试/产品经理/UI设计等
- company_industry (VARCHAR) — 公司行业：互联网/金融/教育/医疗/制造/房地产/零售/物流/能源/媒体/咨询/IT服务/建筑/其他
- key_skills (JSONB) — 所有技能列表 ["Java","Spring","MySQL"]
- required_skills (JSONB) — 必备技能
- preferred_skills (JSONB) — 加分技能
- education_normalized (VARCHAR) — 学历：博士/硕士/本科/大专/高中/不限
- experience_years_min (INTEGER) — 经验年限下限
- experience_years_max (INTEGER) — 经验年限上限
- benefits (JSONB) — 福利列表
- work_mode (VARCHAR) — 远程/现场/混合
- model_used (VARCHAR), enriched_at (TIMESTAMP)

sp_tasks 表（任务）：
- id (VARCHAR), name, source, config (JSONB), status, progress, record_count
- created_at, updated_at

sp_csv_files 表（文件）：
- id (VARCHAR), task_id (VARCHAR FK), filename, filepath, record_count, source
- created_at

sp_jobs 表（原始爬取职位数据，与 Excel 同步入库）：
- id (VARCHAR), task_id (VARCHAR FK), job_id (VARCHAR), data_source (VARCHAR)
- company_name (VARCHAR), job_name (VARCHAR), work_city (VARCHAR)
- salary_range (VARCHAR), education (VARCHAR), work_experience (VARCHAR)
- job_category (VARCHAR), raw_data (JSONB — 完整原始字段)
- created_at (TIMESTAMP)
- UNIQUE(task_id, job_id)，用于幂等重跑

注意事项：
1. 仅生成SELECT语句，绝对禁止INSERT/UPDATE/DELETE/DROP等
2. **极其重要 — 必须返回全部字段**：
   - 必须用: FROM sp_job_enrichments e LEFT JOIN sp_jobs j ON e.task_id = j.task_id AND e.job_id = j.job_id
   - SELECT 必须包含 sp_jobs 全部字段: j.company_name, j.job_name, j.work_city, j.salary_range, j.education, j.work_experience, j.job_category, j.data_source
   - SELECT 必须包含 sp_job_enrichments 全部字段: e.salary_monthly_min, e.salary_monthly_max, e.salary_annual_estimate, e.job_category_l1, e.job_category_l2, e.company_industry, e.key_skills, e.required_skills, e.preferred_skills, e.education_normalized, e.experience_years_min, e.experience_years_max, e.benefits, e.work_mode
   - 禁止使用 SELECT * — 必须显式列出上述全部字段
   - 除非用户明确要求只查询特定字段，否则始终返回上述全部字段
3. 按薪资排序用 e.salary_monthly_max DESC 或 e.salary_monthly_min DESC
4. 统计查询用 COUNT(*)，分组用 GROUP BY — 统计查询也尽量保留上述字段
5. JSONB 数组字段不能直接在 WHERE 中用 = 比较，需要用 @> 操作符
6. LIMIT最多500条
7. 如果用户指定了 task_id，加上 WHERE e.task_id='xxx' 过滤

输出JSON格式：
{
  "sql": "SELECT ... FROM ... WHERE ... LIMIT ?",
  "params": ["参数1", "参数2"],
  "explanation": "用中文简述这条SQL查询了什么",
  "needs_app_filter": true或false,
  "app_filter_reason": "如果需要应用层过滤，说明原因"
}`,
        variables: [],
      },
      {
        category: 'query', promptType: 'user', name: 'NL查询用户提示词',
        content: `用户问题：\${question}

请生成对应的SQL查询。`,
        variables: ['question'],
      },
      // ===== RESUME_PARSE =====
      {
        category: 'resume-parse', promptType: 'system', name: '简历解析系统提示词',
        content: `你是一名专业的简历解析专家。你的任务是从非结构化简历文本中提取结构化信息。

提取规则：
1. name: 从简历开头或个人信息区域提取候选人姓名
2. email/phone: 提取邮箱和手机号
3. education_level: 必须规范化为以下之一 — 高中、大专、本科、硕士、博士。取最高学历
4. school: 毕业院校名称（取最高学历的院校）
5. major: 所学专业
6. graduation_year: 毕业年份（4位数字）
7. work_years: 总工作年限(整数)，通过工作经历时间段累加计算
8. skills: 技能名称数组，去重并统一大小写（如 react → React, nodejs → Node.js, spring boot → Spring Boot）
9. skill_levels: 技能熟练度映射，值为 精通/熟练/了解
10. desired_position: 期望岗位名称，从求职意向或最近一份工作推断
11. desired_city: 期望工作城市
12. desired_salary_min/max: 单位统一为元/月，如写年薪则除以12
13. job_type: 全职/兼职/实习
14. projects: 数组，每个对象含 name/role/duration/description/techStack
15. certifications: 证书名称数组，如 ["PMP", "AWS Solutions Architect"]
16. languages: 语言能力数组，每个对象含 name/level
17. self_evaluation: 自我评价原文摘要（200字以内）
18. parse_confidence: 你对本次提取的整体置信度(0-1)

输出纯 JSON，不要包含 \`\`\` 标记，不要有任何其他文字。所有缺失字段填 null 或空数组。`,
        variables: [],
      },
      {
        category: 'resume-parse', promptType: 'user', name: '简历解析用户提示词',
        content: `请解析以下简历文本并提取结构化信息：

\${resumeText}`,
        variables: ['resumeText'],
      },
      // ===== ANTI_CRAWL =====
      {
        category: 'anti-crawl', promptType: 'system', name: '反爬检测系统提示词',
        content: `你是一个网页安全分析专家。分析给定HTML片段，判断页面类型。

分类标准：
- normal: 正常职位列表/详情页
- captcha: 验证码页面（包含验证码、滑块、图形验证等）
- waf: WAF安全拦截页面（包含"安全验证"、"拦截"、"Security"等）
- login: 需要登录的页面（包含登录表单）
- error: 错误页面（404、500等）
- empty: 空白页或内容极少

输出JSON格式：
{
  "page_type": "normal|captcha|waf|login|error|empty",
  "confidence": 0.0-1.0,
  "indicators": ["发现的可疑特征1", "特征2"],
  "reason": "判断理由"
}`,
        variables: [],
      },
      {
        category: 'anti-crawl', promptType: 'user', name: '反爬检测用户提示词',
        content: `URL: \${url}

HTML内容（前5000字符）:
\${html}`,
        variables: ['url', 'html'],
      },
    ];

    for (const p of seedPrompts) {
      await client.query(`
        INSERT INTO sp_prompts (category, prompt_type, name, content, variables, is_active, sort_order)
        SELECT $1, $2, $3, $4, $5, true, 0
        WHERE NOT EXISTS (
          SELECT 1 FROM sp_prompts WHERE category = $6 AND prompt_type = $7
        )
      `, [p.category, p.promptType, p.name, p.content, JSON.stringify(p.variables), p.category, p.promptType]);
    }

    // ==================== 种子菜单：提示词管理 ====================

    // 提示词管理父菜单 (sortOrder 7 under 系统管理)
    await client.query(`
      INSERT INTO sp_menus (name, path, icon, parent_id, sort_order, component, hidden)
      SELECT '提示词管理', NULL, 'Edit', m.id, 7, NULL, false
      FROM sp_menus m WHERE m.name = '系统管理' AND m.parent_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM sp_menus WHERE name = '提示词管理')
    `);

    // 5 个子菜单
    const promptSubMenus = [
      ['数据增强', '/system/prompts/enrichment', 'DataAnalysis', 1],
      ['市场洞察', '/system/prompts/insights', 'TrendCharts', 2],
      ['NL查询', '/system/prompts/query', 'ChatDotRound', 3],
      ['简历解析', '/system/prompts/resume-parse', 'Document', 4],
      ['反爬检测', '/system/prompts/anti-crawl', 'Lock', 5],
    ];

    for (const [name, path, icon, sortOrder] of promptSubMenus) {
      await client.query(`
        INSERT INTO sp_menus (name, path, icon, parent_id, sort_order, component, hidden)
        SELECT $1, $2, $3, pm.id, $4, NULL, false
        FROM sp_menus pm
        WHERE pm.name = '提示词管理'
          AND pm.parent_id = (SELECT id FROM sp_menus WHERE name = '系统管理' AND parent_id IS NULL)
          AND NOT EXISTS (SELECT 1 FROM sp_menus WHERE name = $5 AND parent_id = pm.id)
      `, [name, path, icon, sortOrder, name]);
    }

    // 内部岗位 sortOrder: 7 → 8（为提示词管理让位）
    await client.query(`
      UPDATE sp_menus SET sort_order = 8
      WHERE name = '内部岗位'
        AND parent_id = (SELECT id FROM sp_menus WHERE name = '系统管理' AND parent_id IS NULL)
        AND sort_order = 7
    `);

    // 授权：将提示词管理及其子菜单授予已有角色（跟随系统管理其他子菜单的权限）
    await client.query(`
      INSERT INTO sp_role_menus (role_id, menu_id)
      SELECT DISTINCT rm.role_id, pm.id
      FROM sp_role_menus rm
      CROSS JOIN sp_menus pm
      WHERE pm.name IN ('提示词管理', '数据增强', '市场洞察', 'NL查询', '简历解析', '反爬检测')
      AND rm.menu_id IN (SELECT id FROM sp_menus WHERE name IN ('用户管理', '角色管理', '权限管理', '菜单管理'))
      AND NOT EXISTS (
        SELECT 1 FROM sp_role_menus rm2
        WHERE rm2.role_id = rm.role_id AND rm2.menu_id = pm.id
      )
    `);

    // 种子菜单：隐藏"智能分析"、"数据大屏"、"关于"
    for (const name of ['智能分析', '数据大屏', '关于']) {
      await client.query(`
        UPDATE sp_menus SET hidden = true
        WHERE name = $1 AND parent_id IS NULL AND hidden = false
      `, [name]);
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