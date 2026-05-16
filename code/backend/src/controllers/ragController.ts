import { Request, Response } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { db } from '../config/database';
import { indexJobEmbeddings, semanticSearch, getEmbeddingStats } from '../services/llm/rag';
import { generateEmbedding } from '../services/llm/embeddings';
import { extractResumeText, parseResumeStructure } from '../services/llm/resumeParser';
import { screenResumeAgainstJobs } from '../services/matchingService';
import { io } from '../app';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.docx', '.pdf', '.txt', '.doc'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件格式: ${ext}，仅支持 ${allowed.join(', ')}`));
    }
  },
});

/**
 * POST /api/rag/index/:taskId
 * 启动职位向量化索引（异步执行，返回前检查增强数据是否存在）
 */
export async function indexTask(req: Request, res: Response) {
  try {
    const { taskId } = req.params;
    if (!taskId) {
      return res.status(400).json({ success: false, error: '缺少 taskId 参数' });
    }

    // 同步检查：增强数据是否存在
    const enrichRow = await db.prepare(
      'SELECT COUNT(*) as cnt FROM sp_job_enrichments WHERE task_id = $1'
    ).get(taskId) as any;
    const enrichCount = enrichRow?.cnt || 0;

    if (enrichCount === 0) {
      return res.status(400).json({
        success: false,
        error: '该任务尚未进行AI数据增强，无法向量化索引。请先在任务列表点击"AI增强"完成数据增强后再试。',
      });
    }

    // 异步执行，立即返回
    res.json({ success: true, data: { taskId, status: 'started', message: `向量化索引已启动（${enrichCount}条增强数据）` } });

    // 后台异步索引，通过 WebSocket 推送完成/失败事件
    indexJobEmbeddings(taskId)
      .then(result => {
        io.emit('rag:indexCompleted', { taskId, ...result, timestamp: Date.now() });
      })
      .catch(e => {
        console.error('[RAG] 索引任务失败:', e.message);
        io.emit('rag:indexFailed', { taskId, error: e.message, timestamp: Date.now() });
      });
  } catch (e: any) {
    console.error('[RAG] indexTask error:', e.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: e.message });
    }
  }
}

/**
 * POST /api/rag/index/:taskId/sync
 * 同步向量化索引（返回完整结果）
 */
export async function indexTaskSync(req: Request, res: Response) {
  try {
    const { taskId } = req.params;
    if (!taskId) {
      return res.status(400).json({ success: false, error: '缺少 taskId 参数' });
    }

    const result = await indexJobEmbeddings(taskId);
    res.json({ success: true, data: result });
  } catch (e: any) {
    console.error('[RAG] indexTaskSync error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * POST /api/rag/search
 * 语义相似搜索
 * Body: { query: string, limit?: number, taskId?: string, minSimilarity?: number }
 */
export async function search(req: Request, res: Response) {
  try {
    const { query, limit, taskId, minSimilarity } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ success: false, error: '请输入搜索内容' });
    }

    const results = await semanticSearch(query.trim(), {
      limit: limit || 10,
      taskId: taskId || undefined,
      minSimilarity: minSimilarity || 0.3,
    });

    res.json({
      success: true,
      data: {
        query,
        results,
        count: results.length,
      },
    });
  } catch (e: any) {
    console.error('[RAG] search error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * GET /api/rag/index/records
 * 分页列出职位向量索引记录
 */
export async function listJobEmbeddings(req: Request, res: Response) {
  try {
    const { taskId, keyword, page = '1', pageSize = '10' } = req.query;
    const pg = Math.max(1, parseInt(page as string) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize as string) || 10));
    const offset = (pg - 1) * ps;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (taskId) {
      where += ' AND je.task_id = ?';
      params.push(taskId);
    }
    if (keyword) {
      where += ' AND (je.job_id ILIKE ? OR je.text_content ILIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const countRow = await db.prepare(
      `SELECT COUNT(*) as total FROM sp_job_embeddings je ${where}`
    ).get(...params) as any;

    const rows = await db.prepare(
      `SELECT je.id, je.task_id, je.job_id, je.job_name, je.company_name, je.job_category_l1, je.job_category_l2, je.work_city, SUBSTRING(je.text_content, 1, 200) as text_preview FROM sp_job_embeddings je ${where} ORDER BY je.job_id DESC LIMIT ? OFFSET ?`
    ).all(...params, ps, offset) as any[];

    console.log(`[RAG] listJobEmbeddings: page=${pg}, pageSize=${ps}, offset=${offset}, found=${rows.length}, total=${countRow?.total}`);

    res.json({
      success: true,
      data: { list: rows, total: Number(countRow?.total) || 0, page: pg, pageSize: ps },
    });
  } catch (e: any) {
    console.error('[RAG] listJobEmbeddings error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * DELETE /api/rag/index/:taskId
 * 删除指定任务的向量索引数据
 */
export async function deleteIndex(req: Request, res: Response) {
  try {
    const { taskId } = req.params;
    if (!taskId) {
      return res.status(400).json({ success: false, error: '缺少 taskId 参数' });
    }

    const result = await db.prepare(
      'DELETE FROM sp_job_embeddings WHERE task_id = $1'
    ).run(taskId);

    console.log(`[RAG] 已删除任务 ${taskId} 的向量索引，共 ${result.changes} 条`);

    res.json({
      success: true,
      data: { taskId, deletedCount: result.changes },
      message: `已删除 ${result.changes} 条向量索引`,
    });
  } catch (e: any) {
    console.error('[RAG] deleteIndex error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * GET /api/rag/stats
 * 获取向量化统计
 */
export async function stats(req: Request, res: Response) {
  try {
    const { taskId } = req.query;
    const data = await getEmbeddingStats(taskId as string | undefined);
    res.json({ success: true, data });
  } catch (e: any) {
    console.error('[RAG] stats error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * POST /api/rag/resume/parse
 * 上传简历文件 → 提取文本 → LLM 结构化解析 → 存储 → 异步生成 embedding
 */
export const parseResume = [
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, error: '请上传简历文件' });
      }

      const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');

      let resumeText: string;
      try {
        resumeText = await extractResumeText(file.buffer, file.mimetype, fileName);
      } catch (parseErr: any) {
        return res.status(400).json({ success: false, error: `文件解析失败: ${parseErr.message}` });
      }

      if (resumeText.length < 10) {
        return res.status(400).json({ success: false, error: '解析出的简历文本内容太短（至少10个字符）' });
      }

      const parsed = await parseResumeStructure(resumeText);

      const result = await db.prepare(`
        INSERT INTO sp_resumes (original_filename, raw_text, name, email, phone, education_level, school, major, graduation_year, work_years, skills, skill_levels, desired_position, desired_city, desired_salary_min, desired_salary_max, job_type, projects, certifications, languages, self_evaluation, parse_confidence, parsed_by_model)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
      `).run(
        fileName, resumeText, parsed.name, parsed.email, parsed.phone,
        parsed.educationLevel, parsed.school, parsed.major, parsed.graduationYear,
        parsed.workYears, JSON.stringify(parsed.skills), JSON.stringify(parsed.skillLevels),
        parsed.desiredPosition, parsed.desiredCity, parsed.desiredSalaryMin,
        parsed.desiredSalaryMax, parsed.jobType, JSON.stringify(parsed.projects),
        JSON.stringify(parsed.certifications), JSON.stringify(parsed.languages),
        parsed.selfEvaluation, parsed.parseConfidence, 'deepseek-v4-pro'
      );

      const resumeId = result.lastID;

      // 异步生成 embedding
      generateEmbedding(resumeText).then(({ embedding }) => {
        const vectorStr = `[${embedding.join(',')}]`;
        db.prepare('UPDATE sp_resumes SET embedding = ?::vector WHERE id = ?').run(vectorStr, resumeId).catch(e => {
          console.error(`[RAG] 简历 embedding 更新失败 id=${resumeId}:`, e.message);
        });
      }).catch(e => {
        console.error(`[RAG] 简历 embedding 生成失败 id=${resumeId}:`, e.message);
      });

      console.log(`[RAG] 简历解析: ${fileName}, 提取文本 ${resumeText.length} 字符, id=${resumeId}`);

      res.json({
        success: true,
        data: { id: resumeId, originalFilename: fileName, textLength: resumeText.length, ...parsed },
        message: '简历解析成功',
      });
    } catch (e: any) {
      console.error('[RAG] parseResume error:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  },
] as any;

/**
 * GET /api/rag/resume/:id
 */
export async function getResume(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const row = await db.prepare('SELECT * FROM sp_resumes WHERE id = ?').get(Number(id)) as any;
    if (!row) {
      return res.status(404).json({ success: false, error: '简历不存在' });
    }
    ['skills', 'skillLevels', 'projects', 'certifications', 'languages'].forEach(f => {
      if (typeof row[f] === 'string') row[f] = JSON.parse(row[f]);
    });
    res.json({ success: true, data: row });
  } catch (e: any) {
    console.error('[RAG] getResume error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * GET /api/rag/resumes
 */
export async function listResumes(req: Request, res: Response) {
  try {
    const { keyword, page = '1', pageSize = '10' } = req.query;
    const pg = Math.max(1, parseInt(page as string) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize as string) || 10));
    const offset = (pg - 1) * ps;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (keyword) {
      where += ' AND (name ILIKE ? OR desired_position ILIKE ? OR skills::text ILIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const countRow = await db.prepare(
      `SELECT COUNT(*) as total FROM sp_resumes ${where}`
    ).get(...params) as any;

    const rows = await db.prepare(
      `SELECT id, original_filename, name, education_level, work_years, desired_position, desired_city, skills, parse_confidence, created_at FROM sp_resumes ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, ps, offset) as any[];

    const list = rows.map((r: any) => ({
      ...r,
      skills: typeof r.skills === 'string' ? JSON.parse(r.skills) : r.skills,
    }));

    res.json({
      success: true,
      data: { list, total: Number(countRow?.total) || 0, page: pg, pageSize: ps },
    });
  } catch (e: any) {
    console.error('[RAG] listResumes error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * PUT /api/rag/resume/:id
 */
export async function updateResume(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const existing = await db.prepare('SELECT id FROM sp_resumes WHERE id = ?').get(Number(id)) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: '简历不存在' });
    }

    const fields = ['name', 'email', 'phone', 'education_level', 'school', 'major', 'graduation_year', 'work_years', 'desired_position', 'desired_city', 'desired_salary_min', 'desired_salary_max', 'job_type', 'self_evaluation'];
    const setClauses: string[] = [];
    const params: any[] = [];

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        setClauses.push(`${f} = ?`);
        params.push(req.body[f]);
      }
    }
    for (const f of ['skills', 'skill_levels', 'projects', 'certifications', 'languages']) {
      if (req.body[f] !== undefined) {
        setClauses.push(`${f} = ?`);
        params.push(JSON.stringify(req.body[f]));
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, error: '没有可更新的字段' });
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(Number(id));

    await db.prepare(`UPDATE sp_resumes SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);

    res.json({ success: true, message: '更新成功' });
  } catch (e: any) {
    console.error('[RAG] updateResume error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * DELETE /api/rag/resume/:id
 */
export async function deleteResume(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const existing = await db.prepare('SELECT id FROM sp_resumes WHERE id = ?').get(Number(id)) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: '简历不存在' });
    }
    await db.prepare('DELETE FROM sp_resumes WHERE id = ?').run(Number(id));
    res.json({ success: true, message: '删除成功' });
  } catch (e: any) {
    console.error('[RAG] deleteResume error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * POST /api/rag/resume/screen
 * 简历-岗位智能筛选: 硬性规则 + 向量相似度 + 技能加分
 * Body: { resumeId?, resumeText?, internalJobId?, limit?, minScore? }
 */
export async function screenResume(req: Request, res: Response) {
  try {
    const { resumeId, resumeText, internalJobId, limit, minScore } = req.body;

    if (!resumeId && (!resumeText || resumeText.trim().length < 10)) {
      return res.status(400).json({ success: false, error: '请提供简历ID或至少10个字符的简历文本' });
    }

    const result = await screenResumeAgainstJobs({
      resumeId: resumeId || undefined,
      resumeText: resumeText?.trim(),
      internalJobId: internalJobId || undefined,
      limit: limit || 20,
      minScore: minScore || 0,
    });

    console.log(`[RAG] 简历筛选完成: 比较${result.totalJobsCompared}个岗位, 返回${result.results.length}条结果`);

    res.json({ success: true, data: result });
  } catch (e: any) {
    console.error('[RAG] screenResume error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * POST /api/rag/resume/screening/save
 * 保存筛选结果到历史记录
 */
export async function saveScreeningResult(req: Request, res: Response) {
  try {
    const { resumeId, results } = req.body;
    if (!results || !Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ success: false, error: '请提供筛选结果' });
    }

    let resumeName = '未知';
    if (resumeId) {
      const r = await db.prepare('SELECT name, original_filename FROM sp_resumes WHERE id = ?').get(Number(resumeId)) as any;
      if (r) resumeName = r.name || r.originalFilename || '未知';
    }

    let saved = 0;
    for (const item of results) {
      await db.prepare(`
        INSERT INTO sp_screening_results (resume_id, internal_job_id, resume_name, internal_job_title, department, total_score, recommendation, hard_rules_passed, education_passed, experience_passed, skills_passed, similarity, skill_bonus, score_breakdown, full_result, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        resumeId || null,
        item.internalJobId || null,
        resumeName,
        item.internalJobTitle,
        item.department || '',
        item.totalScore,
        item.recommendation,
        item.hardRules?.passed || false,
        item.hardRules?.education?.passed || false,
        item.hardRules?.experience?.passed || false,
        item.hardRules?.requiredSkills?.passed || false,
        item.softMatch?.similarity || 0,
        item.scoreBreakdown?.skillBonus || 0,
        JSON.stringify(item.scoreBreakdown || {}),
        JSON.stringify(item),
        'admin'
      );
      saved++;
    }

    console.log(`[RAG] 保存筛选结果: ${saved} 条`);
    res.json({ success: true, data: { saved } });
  } catch (e: any) {
    console.error('[RAG] saveScreeningResult error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * GET /api/rag/resume/screening/history
 * 获取筛选历史记录
 */
export async function getScreeningHistory(req: Request, res: Response) {
  try {
    const { resumeId, internalJobId, page = '1', pageSize = '10' } = req.query;
    const pg = Math.max(1, parseInt(page as string) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize as string) || 10));
    const offset = (pg - 1) * ps;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (resumeId) {
      where += ' AND resume_id = ?';
      params.push(Number(resumeId));
    }
    if (internalJobId) {
      where += ' AND internal_job_id = ?';
      params.push(Number(internalJobId));
    }

    const countRow = await db.prepare(
      `SELECT COUNT(*) as total FROM sp_screening_results ${where}`
    ).get(...params) as any;

    const rows = await db.prepare(
      `SELECT * FROM sp_screening_results ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, ps, offset) as any[];

    const list = rows.map(r => ({
      ...r,
      fullResult: typeof r.fullResult === 'string' ? JSON.parse(r.fullResult) : r.fullResult,
      scoreBreakdown: typeof r.scoreBreakdown === 'string' ? JSON.parse(r.scoreBreakdown) : r.scoreBreakdown,
    }));

    res.json({
      success: true,
      data: { list, total: Number(countRow?.total) || 0, page: pg, pageSize: ps },
    });
  } catch (e: any) {
    console.error('[RAG] getScreeningHistory error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * GET /api/rag/resume/screening/export
 * Excel 导出筛选结果
 */
export async function exportScreeningExcel(req: Request, res: Response) {
  try {
    const { resumeId, internalJobId } = req.query;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (resumeId) {
      where += ' AND resume_id = ?';
      params.push(Number(resumeId));
    }
    if (internalJobId) {
      where += ' AND internal_job_id = ?';
      params.push(Number(internalJobId));
    }

    const rows = await db.prepare(
      `SELECT * FROM sp_screening_results ${where} ORDER BY total_score DESC`
    ).all(...params) as any[];

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('筛选结果');

    sheet.columns = [
      { header: '简历名称', key: 'resumeName', width: 16 },
      { header: '岗位名称', key: 'internalJobTitle', width: 24 },
      { header: '部门', key: 'department', width: 14 },
      { header: '综合得分', key: 'totalScore', width: 10 },
      { header: '推荐等级', key: 'recommendation', width: 12 },
      { header: '硬性规则', key: 'hardRulesPassed', width: 10 },
      { header: '学历通过', key: 'educationPassed', width: 10 },
      { header: '经验通过', key: 'experiencePassed', width: 10 },
      { header: '技能通过', key: 'skillsPassed', width: 10 },
      { header: '语义相似度', key: 'similarity', width: 12 },
      { header: '技能加分', key: 'skillBonus', width: 10 },
      { header: '筛选时间', key: 'createdAt', width: 20 },
    ];

    // 表头样式
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    const recMap: Record<string, string> = { strong: '强烈推荐', moderate: '一般推荐', weak: '勉强匹配', rejected: '不推荐' };

    for (const row of rows) {
      sheet.addRow({
        resumeName: row.resume_name,
        internalJobTitle: row.internal_job_title,
        department: row.department,
        totalScore: row.total_score,
        recommendation: recMap[row.recommendation] || row.recommendation,
        hardRulesPassed: row.hard_rules_passed ? '通过' : '淘汰',
        educationPassed: row.education_passed ? '通过' : '未通过',
        experiencePassed: row.experience_passed ? '通过' : '未通过',
        skillsPassed: row.skills_passed ? '通过' : '未通过',
        similarity: row.similarity ? `${(row.similarity * 100).toFixed(1)}%` : '0%',
        skillBonus: row.skill_bonus,
        createdAt: row.created_at,
      });
    }

    // 按推荐等级着色
    const colorMap: Record<string, string> = { '强烈推荐': 'FF92D050', '一般推荐': 'FFFFC000', '勉强匹配': 'FF909090', '不推荐': 'FFFF6464' };
    sheet.eachRow((r, n) => {
      if (n === 1) return;
      const recCell = r.getCell('recommendation');
      const color = colorMap[recCell.value as string];
      if (color) recCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    });

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('简历筛选结果')}.xlsx`);
    res.send(Buffer.from(buffer));
  } catch (e: any) {
    console.error('[RAG] exportScreeningExcel error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * POST /api/rag/resume/batch-parse
 * 批量上传简历文件并结构化解析
 */
export const batchParseResumes = [
  upload.array('files', 20),
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ success: false, error: '请上传至少一个简历文件' });
      }

      const results: any[] = [];
      let successCount = 0;
      let failCount = 0;

      for (const file of files) {
        try {
          const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
          const resumeText = await extractResumeText(file.buffer, file.mimetype, fileName);

          if (resumeText.length < 10) {
            results.push({ fileName, success: false, error: '文本内容太短' });
            failCount++;
            continue;
          }

          const parsed = await parseResumeStructure(resumeText);

          const result = await db.prepare(`
            INSERT INTO sp_resumes (original_filename, raw_text, name, email, phone, education_level, school, major, graduation_year, work_years, skills, skill_levels, desired_position, desired_city, desired_salary_min, desired_salary_max, job_type, projects, certifications, languages, self_evaluation, parse_confidence, parsed_by_model)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
          `).run(
            fileName, resumeText, parsed.name, parsed.email, parsed.phone,
            parsed.educationLevel, parsed.school, parsed.major, parsed.graduationYear,
            parsed.workYears, JSON.stringify(parsed.skills), JSON.stringify(parsed.skillLevels),
            parsed.desiredPosition, parsed.desiredCity, parsed.desiredSalaryMin,
            parsed.desiredSalaryMax, parsed.jobType, JSON.stringify(parsed.projects),
            JSON.stringify(parsed.certifications), JSON.stringify(parsed.languages),
            parsed.selfEvaluation, parsed.parseConfidence, 'deepseek-v4-pro'
          );

          const resumeId = result.lastID;

          // 异步生成 embedding
          generateEmbedding(resumeText).then(({ embedding }) => {
            const vectorStr = `[${embedding.join(',')}]`;
            db.prepare('UPDATE sp_resumes SET embedding = ?::vector WHERE id = ?').run(vectorStr, resumeId).catch(e => {
              console.error(`[RAG] 批量-简历 embedding 更新失败 id=${resumeId}:`, e.message);
            });
          }).catch(e => {
            console.error(`[RAG] 批量-简历 embedding 生成失败 id=${resumeId}:`, e.message);
          });

          results.push({ id: resumeId, fileName, success: true, name: parsed.name, educationLevel: parsed.educationLevel });
          successCount++;
        } catch (err: any) {
          const fileName = file.originalname ? Buffer.from(file.originalname, 'latin1').toString('utf8') : '未知文件';
          results.push({ fileName, success: false, error: err.message });
          failCount++;
        }
      }

      console.log(`[RAG] 批量解析完成: ${files.length} 个文件, 成功 ${successCount}, 失败 ${failCount}`);

      res.json({
        success: true,
        data: { total: files.length, successCount, failCount, results },
        message: `批量解析完成: 成功 ${successCount} 个, 失败 ${failCount} 个`,
      });
    } catch (e: any) {
      console.error('[RAG] batchParseResumes error:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  },
] as any;

/**
 * DELETE /api/rag/resumes/batch
 * 批量删除简历
 */
export async function batchDeleteResumes(req: Request, res: Response) {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: '请提供要删除的简历ID列表' });
    }

    const placeholders = ids.map(() => '?').join(',');
    const result = await db.prepare(
      `DELETE FROM sp_resumes WHERE id IN (${placeholders})`
    ).run(...ids);

    console.log(`[RAG] 批量删除简历: ${result.changes} 条`);

    res.json({
      success: true,
      data: { deletedCount: result.changes },
      message: `已删除 ${result.changes} 条简历`,
    });
  } catch (e: any) {
    console.error('[RAG] batchDeleteResumes error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * GET /api/rag/resume/screening/export
 * 导出简历库为 Excel
 */
export async function exportResumesExcel(req: Request, res: Response) {
  try {
    const { keyword } = req.query;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (keyword) {
      where += ' AND (name ILIKE ? OR desired_position ILIKE ? OR skills::text ILIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const rows = await db.prepare(
      `SELECT * FROM sp_resumes ${where} ORDER BY created_at DESC`
    ).all(...params) as any[];

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('简历库');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 6 },
      { header: '姓名', key: 'name', width: 12 },
      { header: '邮箱', key: 'email', width: 22 },
      { header: '电话', key: 'phone', width: 16 },
      { header: '学历', key: 'educationLevel', width: 8 },
      { header: '毕业院校', key: 'school', width: 20 },
      { header: '专业', key: 'major', width: 16 },
      { header: '毕业年份', key: 'graduationYear', width: 10 },
      { header: '工作年限', key: 'workYears', width: 8 },
      { header: '技能', key: 'skills', width: 30 },
      { header: '期望岗位', key: 'desiredPosition', width: 18 },
      { header: '期望城市', key: 'desiredCity', width: 12 },
      { header: '期望薪资下限', key: 'desiredSalaryMin', width: 12 },
      { header: '期望薪资上限', key: 'desiredSalaryMax', width: 12 },
      { header: '工作类型', key: 'jobType', width: 10 },
      { header: '证书', key: 'certifications', width: 20 },
      { header: '自我评价', key: 'selfEvaluation', width: 30 },
      { header: '解析置信度', key: 'parseConfidence', width: 10 },
      { header: '文件名', key: 'originalFilename', width: 24 },
      { header: '创建时间', key: 'createdAt', width: 20 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

    for (const row of rows) {
      const skills = typeof row.skills === 'string' ? JSON.parse(row.skills || '[]') : (row.skills || []);
      const certs = typeof row.certifications === 'string' ? JSON.parse(row.certifications || '[]') : (row.certifications || []);
      sheet.addRow({
        id: row.id,
        name: row.name || '',
        email: row.email || '',
        phone: row.phone || '',
        educationLevel: row.education_level || '',
        school: row.school || '',
        major: row.major || '',
        graduationYear: row.graduation_year || '',
        workYears: row.work_years || '',
        skills: Array.isArray(skills) ? skills.join(', ') : '',
        desiredPosition: row.desired_position || '',
        desiredCity: row.desired_city || '',
        desiredSalaryMin: row.desired_salary_min || '',
        desiredSalaryMax: row.desired_salary_max || '',
        jobType: row.job_type || '',
        certifications: Array.isArray(certs) ? certs.join(', ') : '',
        selfEvaluation: (row.self_evaluation || '').substring(0, 500),
        parseConfidence: row.parse_confidence ? `${(row.parse_confidence * 100).toFixed(0)}%` : '',
        originalFilename: row.original_filename || '',
        createdAt: row.created_at || '',
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('简历库导出')}.xlsx`);
    res.send(Buffer.from(buffer));
  } catch (e: any) {
    console.error('[RAG] exportResumesExcel error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}
