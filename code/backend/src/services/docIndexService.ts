import { db, pgvectorAvailable } from '../config/database';
import { generateEmbedding } from './llm/embeddings';
import { SourceType, scanFiles, generateSectionId, type ScannedFile } from './docSourceScanner';
import * as path from 'path';

interface DocSection {
  sectionId: string;
  title: string;
  content: string; // HTML content
  sourceType?: SourceType;
  filePath?: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#?\w+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitLongText(text: string, maxLen: number = 3000): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    const cutoff = remaining.lastIndexOf('。', maxLen);
    const splitAt = cutoff > maxLen * 0.5 ? cutoff + 1 : maxLen;
    chunks.push(remaining.substring(0, splitAt).trim());
    remaining = remaining.substring(splitAt).trim();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

/** Markdown 分块：优先按 ## 标题分割，超长按句号二次分割 */
function splitMarkdown(text: string, maxLen: number = 3000): string[] {
  // 按 ## 标题分割
  const sections = text.split(/\n(?=## )/).filter(s => s.trim().length > 0);
  if (sections.length <= 1) return splitLongText(text, maxLen);

  const chunks: string[] = [];
  for (const sec of sections) {
    if (sec.length <= maxLen) {
      chunks.push(sec.trim());
    } else {
      chunks.push(...splitLongText(sec.trim(), maxLen));
    }
  }
  return chunks;
}

/** 源代码分块：优先按双空行分割，再按导出边界分割，超长按换行截断 */
function splitSourceCode(text: string, maxLen: number = 3000): string[] {
  // 按双空行优先分割（函数/类之间的自然分隔）
  const blocks = text.split(/\n\n\n+/).filter(b => b.trim().length > 0);
  if (blocks.length <= 1) return splitLongText(text, maxLen);

  const chunks: string[] = [];
  for (const block of blocks) {
    if (block.length <= maxLen) {
      chunks.push(block.trim());
    } else {
      // 按 export function / export class / export const 边界继续分割
      const subBlocks = block.split(/\n(?=export\s+(?:function|class|const|interface|type|enum|async\s+function))/);
      for (const sub of subBlocks) {
        if (sub.trim().length <= maxLen) {
          chunks.push(sub.trim());
        } else {
          chunks.push(...splitLongText(sub.trim(), maxLen));
        }
      }
    }
  }
  return chunks;
}

// Documentation content extracted from frontend Docs.vue
export const DOC_SECTIONS: DocSection[] = [
  {
    sectionId: 'intro',
    title: '项目简介',
    content: `<p>本系统可从<strong>智联招聘、前程无忧</strong>等主流招聘平台自动采集职位数据，并通过 <strong>AI 大模型</strong> 对数据进行智能增强（薪资标准化、技能提取、行业分类）、深度分析报告生成、自然语言查询等高级处理。</p>
<h3>适用场景</h3><ul><li>人力资源市场调研与薪酬分析</li><li>技术岗位技能需求趋势追踪</li><li>企业招聘策略数据支撑</li><li>AI 全栈开发实战培训</li></ul>`
  },
  {
    sectionId: 'feat-crawl',
    title: '数据采集',
    content: `<h2>多平台支持</h2><p>系统支持智联招聘和前程无忧两大主流招聘平台的数据采集。功能包括：批量任务（多关键词×多城市笛卡尔积组合）、断点续传（浏览器崩溃后从上次中断位置恢复，最大10次重启）、智能去重（基于职位ID自动去重）、反爬对抗（AI页面分类+硬编码签名检测+指纹随机化+IP代理池+自动降级）、实时监控（WebSocket推送进度条、分级彩色日志、详情页阶段状态）、Excel导出（格式化.xlsx输出，带样式表头、冻结行、交替行颜色）。</p>`
  },
  {
    sectionId: 'feat-enrich',
    title: 'AI 数据增强',
    content: `<p>爬取完成后，通过 LLM 自动对每条职位数据进行标准化处理，输出结构化增强数据。增强维度包括：薪资标准化（salary_monthly_min/max）、职位分类（job_category_l1/l2，共14大类）、公司行业（company_industry，14类标准分类）、技能提取（key_skills/required/preferred）、学历规范（education_normalized：本科/硕士/博士/大专）、经验年限（experience_years_min/max）、福利识别（benefits：五险一金/年终奖/双休等关键词识别）、工作模式（work_mode：远程/现场/混合三分类）。技术特点：BATCH_SIZE=1逐条处理，500ms间隔避免API限流；3层降级JSON解析；3次重试+递增temperature提高成功率；ON CONFLICT UPSERT保证幂等可重跑。</p>`
  },
  {
    sectionId: 'feat-rag',
    title: '语义搜索 (RAG)',
    content: `<p>基于 pgvector 向量数据库实现职位知识库的语义相似搜索。RAG架构：Excel原始数据→job_enrichments(LLM增强)→buildJobText()拼接文本→Ollama embedding(nomic-embed-text,768维)→job_embeddings(pgvector vector(768)+IVFFlat余弦索引)→semanticSearch()余弦相似度排序。</p><p>核心特性：768维向量、IVFFlat索引(100个列表)、混合数据源(Excel原始字段+增强字段)、查询扩展(短查询≤10字符自动触发30+术语映射表扩展)、幂等索引(ON CONFLICT UPSERT)、相似度过滤(默认阈值0.5)。</p>`
  },
  {
    sectionId: 'feat-insights',
    title: 'AI 市场洞察',
    content: `<p>系统提供两层数据分析能力：数据看板（Dashboard，实时汇总统计）和 AI 深度分析报告（LLM生成专业洞察）。数据看板包含5个核心指标卡片（总职位数、采集任务、企业数量、平均薪资、最高薪资）、黑龙江省区域分布（地图+明细双面板）、维度标签切换（城市/薪资/学历/经验/技能词云）。AI深度分析报告从job_enrichments表聚合多维度统计（薪资分布、职位分类、技能排行、行业分布、学历/经验要求、工作模式），LLM输出结构化JSON(title/summary/sections/charts_config)，每个section包含标题、正文(Markdown)、关键发现。</p>`
  },
  {
    sectionId: 'feat-query',
    title: '自然语言查询',
    content: `<p>聊天式界面，用户用自然语言查询职位数据，系统自动完成Text-to-SQL+执行+总结全流程。处理流程：LLM分析用户问题提取关键条件→基于job_enrichments表结构生成PostgreSQL查询→安全校验(白名单验证，仅允许SELECT)→参数化执行(LIMIT 500)→LLM用2-3句话总结查询结果。安全白名单机制：正则验证仅允许SELECT/WITH语句，关键字黑名单拦截INSERT/DROP/TRUNCATE/DELETE/ALTER/UPDATE/CREATE/EXEC/GRANT/REVOKE，无LIMIT自动追加LIMIT 500，分号分割后只取第一条防多语句注入。</p>`
  },
  {
    sectionId: 'feat-anticrawl',
    title: 'AI 反爬对抗',
    content: `<p>在传统规则检测之上，引入LLM智能分类与应对能力。6种页面类型：normal/captcha/waf/login/error/empty。HTML截断取前3000字符减小LLM token消耗，System Prompt定义6种反爬页面类型特征，LLM分类返回type+confidence，5秒冷却避免高频调用。选择器推荐：DOM解析返回0条时触发，LLM分析HTML推荐新CSS选择器按置信度排序，按置信度降序尝试首个命中即返回。应对策略：LLM根据分类+重试次数+浏览器状态动态决策(continue/wait/retry/switch_ip/abort)。</p>`
  },
  {
    sectionId: 'feat-llm-routing',
    title: 'LLM 任务路由',
    content: `<p>系统支持同时配置多个AI模型，不同任务类型自动选择对应模型执行。四种任务类型：enrichment(数据增强)、insights(智能洞察)、query(NL查询)、anti-crawl(反爬检测)。路由选择逻辑：刷新缓存→精确匹配task_routing JSONB数组→返回首个匹配→兜底返回首个active配置。60秒缓存机制减少数据库查询频率。API Key使用AES-256-GCM加密存储，格式检测自动兼容明文/密文。</p>`
  },
  {
    sectionId: 'feat-embedding',
    title: '文本向量化',
    content: `<p>系统通过Ollama本地Embedding模型+pgvector向量数据库实现职位数据的语义搜索。核心流程：将每条职位拼接为自然语言文本→生成768维向量→存入pgvector→余弦相似度搜索。使用nomic-embed-text模型(768维)，本地推理数据不出服务器。IVFFlat索引100个聚类列表加速近似搜索(比全量KNN快10-100倍)。查询扩展：内置30+术语映射表，短查询自动扩展解决语义稀疏问题。</p>`
  },
  {
    sectionId: 'feat-proxy',
    title: 'IP 代理池',
    content: `<p>系统集成第三方HTTP正向代理池(jhao104/proxy_pool)，为爬虫提供动态IP轮换能力。代理池默认地址http://127.0.0.1:5010，连续失败保护(maxConsecutiveFailures=5)。代理健康检查checkHealth()：获取代理后访问目标站验证可用性(8s超时，仅2xx视为可用，禁止重定向，最多3次尝试)。智联使用浏览器级代理(--proxy-server参数)，51job使用axios回退路径代理(浏览器走直连)。容错降级策略：代理池不可达→跳过代理直连；隧道失败→自动切换+浏览器重启；全部不可用→降级直连模式。</p>`
  },
  {
    sectionId: 'tech-stack',
    title: '技术栈',
    content: `<h3>前端</h3><p>Vue 3(Composition API)、Element Plus(UI组件库)、Pinia(状态管理)、Vue Router(路由)、ECharts 6(数据可视化)、Socket.IO Client(WebSocket通信)、Axios(HTTP客户端)、Vite(构建工具)、marked(Markdown渲染)。</p><h3>后端</h3><p>Node.js+Express(Web服务框架)、TypeScript(类型安全)、PostgreSQL/SeaboxSQL(数据存储)、Puppeteer(浏览器自动化爬虫)、Socket.IO(实时推送)、ExcelJS(Excel读写)、AES-256-GCM(API Key加密存储)。</p><h3>AI模型支持</h3><p>DeepSeek(v4-pro)、OpenAI(GPT-4o)、智谱(GLM)、Anthropic(Claude)、Ollama(Qwen/Llama本地部署)。</p>`
  },
  {
    sectionId: 'architecture',
    title: '系统架构',
    content: `<p>前端Vue 3(:3000)→HTTP REST+WebSocket→后端Express(:3004)→SQL→PostgreSQL(:7300)+Puppeteer(Headless Chrome)。关键设计：LLM任务路由(不同任务类型自动选择对应模型)、加密存储(API Key AES-256-GCM加密)、WebSocket房间(每个任务独立Socket.IO room)、幂等增强(ON CONFLICT UPSERT支持安全重跑)。</p>`
  },
  {
    sectionId: 'quickstart',
    title: '快速开始',
    content: `<h3>环境要求</h3><p>Node.js>=18.0、PostgreSQL>=14、Chrome/Chromium(Puppeteer自动下载)、npm>=9。</p><h3>安装与启动</h3><p>克隆项目→安装前端依赖(cd code/frontend && npm install)→安装后端依赖(cd ../backend && npm install)→启动后端(cd code/backend && npm run dev,端口3004)→启动前端(cd code/frontend && npm run dev,端口3000)→访问http://localhost:3000。Windows用户可直接双击根目录start-dev.bat一键启动。</p><h3>配置LLM</h3><p>访问系统→侧边栏AI配置→添加配置→选择提供商→填入API Key→在任务路由中勾选需要的任务类型→测试连接验证。</p>`
  },
  {
    sectionId: 'api-tasks',
    title: '任务管理 API',
    content: `<p>Base: /api/tasks，共12个端点。POST / 创建任务、GET / 任务列表(分页/状态筛选)、GET /:id 任务详情、GET /:id/logs 任务日志、POST /:id/start 启动任务、POST /:id/stop 停止任务、POST /:id/pause 暂停任务、POST /:id/resume 恢复任务、DELETE /:id 删除任务及关联文件、PUT /:id/config 更新任务配置、GET /regions/list 省市列表、GET /stats 全库任务统计。</p>`
  },
  {
    sectionId: 'api-files',
    title: '文件管理 API',
    content: `<p>Base: /api/files，共8个端点。GET / 文件列表(分页/来源/关键词/任务ID筛选)、GET /:id 文件详情、GET /:id/analyze 深度分析、GET /:id/preview 预览前N条数据、GET /:id/download 下载文件、GET /task/:taskId 按任务查询文件、DELETE /:id 删除文件、POST /batch-delete 批量删除。</p>`
  },
  {
    sectionId: 'api-rag',
    title: 'RAG 知识库 API',
    content: `<p>Base: /api/rag，共5个端点。POST /index/:taskId 异步索引任务数据到向量库(WebSocket推送进度)、POST /index/:taskId/sync 同步索引、DELETE /index/:taskId 删除任务索引、POST /search 语义搜索(Body: query/taskId?/limit?/minSimilarity?)、GET /stats 查询向量库统计。</p>`
  },
  {
    sectionId: 'api-llm',
    title: 'AI 服务 API',
    content: `<p>Base: /api/llm，共18个端点。LLM配置管理：GET /config配置列表、POST /config保存配置、DELETE /config/:id删除、GET /health健康检查、POST /test测试调用。数据增强：POST /enrich/:taskId启动增强、GET /enrich/:taskId/status进度、GET /enrich/:taskId/result结果。市场洞察：POST /insights/:fileId生成报告、GET /insights/:fileId/history历史、GET /insights/report/:reportId详情。自然语言查询：POST /query执行查询、GET /query/history历史、DELETE /query/:id删除。AI反爬：POST /anti-crawl/classify页面分类、POST /anti-crawl/selectors选择器推荐、POST /anti-crawl/action应对策略。</p>`
  },
  {
    sectionId: 'api-auth',
    title: '认证 API',
    content: `<p>Base: /api/auth，共7个端点。GET /authorize-url 获取OAuth2授权URL、GET /callback OAuth2回调(交换Token+设置Cookie)、POST /refresh-token 刷新Access Token、GET /user-info 当前用户信息、POST /validate-token 验证Token有效性、POST /logout 登出、POST /local-login 本地账号密码登录。</p>`
  },
  {
    sectionId: 'api-system',
    title: '系统管理 API',
    content: `<p>RBAC权限管理体系，包含用户、角色、权限、菜单四组CRUD，共23个端点。用户管理/api/users：GET/POST/PUT/DELETE + PUT /:id/roles更新角色关联。角色管理/api/roles：GET/POST/PUT/DELETE + GET /all全部角色。权限管理/api/permissions：GET/POST/PUT/DELETE + GET /all全部权限(按resource分组)。菜单管理/api/menus：GET/POST/PUT/DELETE + GET /tree菜单树(嵌套结构)。</p>`
  },
  {
    sectionId: 'database',
    title: '数据库表结构',
    content: `<p>Schema: liangwenqing，共15张表。sp_tasks爬虫任务(id/name/source/config/status/record_count)，sp_jobs原始职位数据(task_id/job_id/data_source/company_name/job_name/work_city/salary_range/education/work_experience/raw_data JSONB)，sp_csv_files导出文件，sp_job_enrichments AI增强结果(salary_monthly_min/max/job_category_l1/l2/company_industry/key_skills JSONB/education_normalized/experience_years_min/max/benefits JSONB/work_mode)，sp_market_reports AI洞察报告，sp_llm_config AI模型配置(provider/model_name/api_key_encrypted AES-256-GCM/task_routing JSONB)，sp_job_embeddings RAG向量库(embedding vector(768)/IVFFlat索引)，sp_saved_queries NL查询历史。</p>`
  },
  {
    sectionId: 'guide-crawl',
    title: '使用指南：采集数据',
    content: `<p>进入数据采集→创建任务→输入关键词(如Java开发)→点击添加按钮→选择目标城市(可多选)→可选：指定目标企业列表过滤→设置最大页数→点击创建。任务列表点击任务名称可跳转文件管理页查看该任务的文件。实时监控：WebSocket推送进度条+分级彩色日志+详情页阶段状态。批量创建支持多关键词×多城市自动生成笛卡尔积组合任务。任务断点续传，最大10次崩溃恢复。</p>`
  },
  {
    sectionId: 'guide-enrich',
    title: '使用指南：AI 增强数据',
    content: `<p>等待任务状态变为已完成→在任务列表找到目标任务→点击行右侧的AI增强按钮→确认后系统逐条调用LLM处理每条职位数据(BATCH_SIZE=1+500ms间隔+3次重试)→WebSocket实时推送进度。增强维度：薪资标准化/职位分类(14类)/行业识别/技能提取/学历规范/经验年限/福利/工作模式。增强基于ON CONFLICT UPSERT，重复点击不会产生重复数据，可安全重跑。支持3层JSON降级解析确保鲁棒性。</p>`
  },
  {
    sectionId: 'guide-rag',
    title: '使用指南：语义搜索',
    content: `<p>确保任务已完成爬取+AI增强→进入语义搜索页面→选择要索引的任务→点击开始索引(系统自动从Excel读取原始字段+从job_enrichments读取增强字段→调用Ollama nomic-embed-text生成768维向量→存入pgvector IVFFlat索引)→索引完成后输入自然语言查询→结果按余弦相似度降序排列。短查询(≤10字符)自动触发30+术语映射表扩展。可点击删除索引清理向量数据重新索引。需要Ollama运行nomic-embed-text模型(768维)。</p>`
  },
  {
    sectionId: 'guide-insights',
    title: '使用指南：AI 深度分析',
    content: `<p>数据看板(Dashboard)：首页汇总全库统计(5张统计卡片+黑龙江省地图+经验年限柱状图+技能词云)。智能分析：从文件管理点击分析进入单文件分析页面→展示基础图表(薪资分布/城市分布/学历分布等7种)→点击AI深度分析按钮→系统自动聚合多维度统计→调用LLM生成专业报告→约20-40秒后展示摘要+各维度分析+AI生成的可视化图表(含ECharts配置)。支持历史报告切换查看。</p>`
  },
  {
    sectionId: 'guide-query',
    title: '使用指南：自然语言查询',
    content: `<p>进入智能查询页面→可选顶部下拉框选择目标任务限定查询范围→输入自然语言问题(如"薪资最高的10个岗位"、"互联网行业本科学历岗位数量"、"各城市Java岗位平均薪资对比")→系统自动生成SQL→安全校验→执行查询→LLM总结结果。结果展示：自然语言总结+数据表格+生成的SQL。</p>`
  },
  {
    sectionId: 'guide-config',
    title: '使用指南：AI 配置管理',
    content: `<p>进入AI配置页面→点击添加配置→选择提供商(DeepSeek/OpenAI/智谱/Anthropic/Ollama)→填入模型名称(如deepseek-v4-pro/gpt-4o/qwen3:14b)+API Key(自动AES-256-GCM加密存储)+Base URL→在任务路由中勾选该模型用于哪些任务类型→点击测试连接验证连通性和延迟。</p>`
  },
  {
    sectionId: 'websocket',
    title: 'WebSocket 事件',
    content: `<p>WebSocket端口3004(独立于HTTP)，传输方式transports:['websocket'](纯WebSocket无轮询降级)，自动重连+指数退避。客户端→服务端：task:subscribe(加入任务房间)、task:unsubscribe(离开)、task:stop(停止任务)。服务端→客户端：task:progress(采集进度)、task:status(状态变更)、task:log(实时分级日志)、task:completed(采集完成)、task:failed(采集失败)、enrichment:progress(AI增强进度，订阅时自动重放)、insights:progress(AI报告生成进度)、insights:completed(报告完成)。</p>`
  },
  {
    sectionId: 'diagnostics',
    title: '系统诊断手册',
    content: `<p>项目docs/diagnostics/目录下收录了146份诊断文档，按时间顺序记录了系统开发过程中的所有关键问题分析、根因定位和修复方案。涵盖主题：认证登录/OAuth2/分析模块、爬虫基础配置+日志持久化、任务进度问题分析、智联招聘解析器深度修复、诊断日志补丁完善、并发/浏览器崩溃/反爬修复等。</p>`
  },
  {
    sectionId: 'api-analysis',
    title: '数据分析 API（5 个端点）',
    content: `<p><strong>Base:</strong> <code>/api/analysis</code></p><table><tr><th>方法</th><th>路径</th><th>说明</th></tr><tr><td>POST</td><td><code>/analyze</code></td><td>分析 CSV/Excel 文件</td></tr><tr><td>GET</td><td><code>/salary/:fileId</code></td><td>薪资区间分布</td></tr><tr><td>GET</td><td><code>/city/:fileId</code></td><td>城市分布 Top 10</td></tr><tr><td>GET</td><td><code>/education/:fileId</code></td><td>学历要求分布</td></tr><tr><td>GET</td><td><code>/experience/:fileId</code></td><td>经验要求分布</td></tr></table>`
  },
  {
    sectionId: 'api-dashboard',
    title: '数据看板 API（2 个端点）',
    content: `<p>汇总全库数据提供看板统计，不依赖单文件查询。</p><table><tr><th>方法</th><th>路径</th><th>说明</th></tr><tr><td>GET</td><td><code>/api/dashboard/overview</code></td><td>全库概览统计（总职位/任务/企业/薪资 + 6 维度分布 + 技能词云）</td></tr><tr><td>GET</td><td><code>/api/regions/stats?dim=city</code></td><td>黑龙江省区域分布统计</td></tr></table>`
  },
  {
    sectionId: 'faq',
    title: '常见问题',
    content: `<p>常见问题包括：数据采集失败怎么办(检查目标网站是否可访问，确认代理池状态，查看任务日志)；AI增强失败怎么处理(确认LLM配置正确且API Key有效，检查Ollama服务是否运行，查看增强进度日志)；语义搜索无结果(确认任务已索引，检查pgvector扩展是否安装，尝试降低相似度阈值)；自然语言查询报错(检查生成的SQL是否正确，确认表中有数据，查看安全校验日志)。更多问题请查看系统诊断手册。</p>`
  },
];

export async function indexAllDocs(
  onProgress?: (message: string) => void,
  sourceTypes?: SourceType[]
): Promise<{ total: number; indexed: number; skipped: number; errors: number }> {
  if (!pgvectorAvailable) {
    throw new Error('pgvector 扩展未安装，无法进行文档向量化');
  }

  const emit = (msg: string) => {
    console.log(`[DocIndex] ${msg}`);
    onProgress?.(msg);
  };

  const INSERT_SQL = `
    INSERT INTO sp_doc_embeddings (section_id, section_title, chunk_index, text_content, embedding, source_type, file_path)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (section_id, chunk_index) DO UPDATE SET
      embedding = EXCLUDED.embedding,
      text_content = EXCLUDED.text_content,
      source_type = EXCLUDED.source_type,
      file_path = EXCLUDED.file_path
  `;

  async function indexSource(
    sectionId: string,
    title: string,
    rawText: string,
    sourceType: SourceType,
    filePath?: string,
    isHtml?: boolean
  ): Promise<{ idx: number; sk: number; chunks: number; chunkErrs: number }> {
    const plainText = isHtml ? stripHtml(rawText) : rawText;

    const existing = await db.prepare(
      'SELECT COUNT(*) as cnt FROM sp_doc_embeddings WHERE section_id = $1'
    ).get(sectionId) as any;

    if (existing?.cnt > 0) {
      emit(`跳过已索引: ${title} (已有 ${existing.cnt} 个片段)`);
      return { idx: 0, sk: 1, chunks: 0, chunkErrs: 0 };
    }

    // 根据类型选择分块策略
    let chunks: string[];
    if (isHtml || sourceType === SourceType.DOC_SECTION) {
      chunks = splitLongText(plainText, 3000);
    } else if (sourceType === SourceType.BACKEND_SOURCE || sourceType === SourceType.FRONTEND_SOURCE) {
      chunks = splitSourceCode(plainText, 3000);
    } else {
      chunks = splitMarkdown(plainText, 3000);
    }

    let errs = 0;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk.length < 50) continue;

      try {
        const { embedding } = await generateEmbedding(chunk);
        const vectorStr = `[${embedding.join(',')}]`;
        await db.prepare(INSERT_SQL).run(
          sectionId, title, i, chunk, vectorStr, sourceType, filePath || null
        );
      } catch (embedErr: any) {
        console.error(`[DocIndex] 向量化失败 ${sectionId}[${i}]:`, embedErr.message);
        errs++;
        continue;
      }

      if (i < chunks.length - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    emit(`已索引: ${title} (${chunks.length} 个片段)`);
    return { idx: 1, sk: 0, chunks: chunks.length, chunkErrs: errs };
  }

  // ========== Phase 1: DOC_SECTIONS ==========
  const wantDocs = !sourceTypes || sourceTypes.includes(SourceType.DOC_SECTION);

  let indexed = 0;
  let skipped = 0;
  let errors = 0;
  let totalChunks = 0;

  if (wantDocs) {
    emit(`开始索引 ${DOC_SECTIONS.length} 个帮助文档章节...`);

    for (const section of DOC_SECTIONS) {
      try {
        const result = await indexSource(
          section.sectionId,
          section.title,
          section.content,
          SourceType.DOC_SECTION,
          undefined,
          true
        );
        indexed += result.idx;
        skipped += result.sk;
        totalChunks += result.chunks;
        errors += result.chunkErrs;
      } catch (e: any) {
        errors++;
        console.error(`[DocIndex] 章节 ${section.sectionId} 索引失败:`, e.message);
        if (errors > 15) throw new Error('向量化错误过多（>15），已中止');
      }
    }
  }

  // ========== Phase 2: 文件源 ==========
  const wantFiles = !sourceTypes || sourceTypes.some(s => s !== SourceType.DOC_SECTION);

  if (wantFiles) {
    const fileSourceTypes = sourceTypes?.filter(s => s !== SourceType.DOC_SECTION);
    const scannedFiles = scanFiles(fileSourceTypes?.length ? fileSourceTypes : undefined);
    emit(`发现 ${scannedFiles.length} 个源文件待索引...`);

    for (const file of scannedFiles) {
      try {
        const sectionId = generateSectionId(file);
        const result = await indexSource(
          sectionId,
          file.title,
          file.content,
          file.sourceType,
          file.filePath,
          false
        );
        indexed += result.idx;
        skipped += result.sk;
        totalChunks += result.chunks;
        errors += result.chunkErrs;
      } catch (e: any) {
        errors++;
        console.error(`[DocIndex] 文件 ${file.filePath} 索引失败:`, e.message);
        if (errors > 50) throw new Error('文件索引错误过多（>50），已中止');
      }
    }
  }

  const totalDocs = wantDocs ? DOC_SECTIONS.length : 0;
  emit(`文档索引完成：索引 ${indexed}，跳过 ${skipped}，错误 ${errors}，总片段 ${totalChunks}`);
  return { total: totalDocs + (wantFiles ? 1 : 0), indexed, skipped, errors };
}

export interface DocSearchResult {
  sectionId: string;
  sectionTitle: string;
  chunkIndex: number;
  textContent: string;
  similarity: number;
  sourceType: string;
  filePath?: string;
}

// 文档搜索关键词扩展映射（中文查询术语 → 文档章节关键词）
const DOC_KEYWORD_MAP: Record<string, string[]> = {
  '数据库': ['数据库', '表结构', 'sp_tasks', 'sp_jobs', 'PostgreSQL'],
  '表结构': ['数据库', '表结构', 'sp_', '字段'],
  '数据表': ['数据库', '表结构', 'sp_'],
  'api': ['API', '端点', '/api/', 'Base'],
  '接口': ['API', '端点', '/api/'],
  '采集': ['数据采集', '爬虫', '反爬', '智联', '51job'],
  '爬虫': ['数据采集', '爬虫', '反爬', 'Puppeteer', '浏览器'],
  '反爬': ['反爬', 'WAF', '验证', '代理'],
  '增强': ['AI 数据增强', '增强', 'LLM', '标准化'],
  '搜索': ['语义搜索', 'RAG', '向量', 'pgvector'],
  'rag': ['语义搜索', 'RAG', '向量', 'pgvector', 'embedding'],
  '查询': ['自然语言查询', 'SQL', 'Text-to-SQL', 'NL'],
  '看板': ['数据看板', 'Dashboard', '统计', '图表'],
  '大屏': ['数据大屏', '大屏', '全屏'],
  '配置': ['AI 配置', 'LLM 配置', '模型配置', 'API Key'],
  '模型': ['AI', 'LLM', '模型', 'DeepSeek', 'OpenAI', 'Ollama'],
  'llm': ['AI', 'LLM', '模型', '路由', '配置'],
  '架构': ['系统架构', '架构', '前端', '后端', 'PostgreSQL'],
  '技术栈': ['技术栈', 'Vue', 'Express', 'PostgreSQL', 'Puppeteer'],
  '部署': ['快速开始', '安装', '启动', '环境'],
  '安装': ['快速开始', '安装', '启动', '环境', 'npm'],
  '启动': ['快速开始', '启动', '端口'],
  '向量': ['向量化', 'embedding', 'pgvector', 'nomic'],
  'embedding': ['向量化', 'embedding', 'pgvector', 'nomic'],
  '代理': ['IP 代理池', '代理', 'proxy', '隧道'],
  'proxy': ['IP 代理池', '代理', 'proxy', '隧道'],
  'websocket': ['WebSocket', 'socket', '事件', '实时'],
  'socket': ['WebSocket', 'socket', '事件', '实时'],
  '认证': ['认证', 'OAuth2', '登录', 'Token'],
  '登录': ['认证', 'OAuth2', '登录', 'Token', '本地登录'],
  'oauth': ['认证', 'OAuth2', '回调', 'Token'],
  '权限': ['系统管理', 'RBAC', '角色', '用户管理'],
  '角色': ['系统管理', 'RBAC', '角色', '权限'],
  '用户管理': ['系统管理', '用户管理', '角色', '权限'],
  '菜单': ['系统管理', '菜单', '导航', '侧边栏'],
  '系统管理': ['系统管理', 'RBAC', '用户', '角色', '权限', '菜单'],
  'rbac': ['系统管理', 'RBAC', '用户', '角色', '权限', '菜单'],
};

export async function searchDocs(
  query: string,
  topK: number = 5,
  minSimilarity: number = 0.25
): Promise<DocSearchResult[]> {
  if (!pgvectorAvailable) {
    return keywordSearch(query, topK);
  }

  try {
    const { embedding } = await generateEmbedding(query);
    const vectorStr = `[${embedding.join(',')}]`;

    const sql = `
      SELECT section_id, section_title, chunk_index, text_content,
             source_type, file_path,
             1 - (embedding <=> $1::vector) AS similarity
      FROM sp_doc_embeddings
      WHERE 1 - (embedding <=> $1::vector) >= $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `;

    const rows = await db.prepare(sql).all(vectorStr, minSimilarity, topK) as any[];

    const results: DocSearchResult[] = rows.map((r: any) => ({
      sectionId: r.sectionId || r.section_id,
      sectionTitle: r.sectionTitle || r.section_title,
      chunkIndex: r.chunkIndex || r.chunk_index || 0,
      textContent: r.textContent || r.text_content,
      similarity: Math.round((r.similarity || 0) * 10000) / 10000,
      sourceType: r.source_type || 'doc_section',
      filePath: r.file_path || undefined,
    }));

    // 如果向量搜索结果不足，用关键词搜索补充
    if (results.length < topK) {
      const keywordResults = await keywordSearch(query, topK - results.length);
      const existingIds = new Set(results.map(r => `${r.sectionId}:${r.chunkIndex}`));
      for (const kr of keywordResults) {
        if (!existingIds.has(`${kr.sectionId}:${kr.chunkIndex}`)) {
          results.push(kr);
        }
      }
    }

    return results;
  } catch (e: any) {
    console.warn('[DocIndex] 向量搜索失败，回退到关键词搜索:', e.message);
    return keywordSearch(query, topK);
  }
}

async function keywordSearch(query: string, limit: number = 5): Promise<DocSearchResult[]> {
  const lower = query.toLowerCase();
  const keywords: string[] = [];

  // 1. 从映射表获取扩展关键词
  for (const [term, kws] of Object.entries(DOC_KEYWORD_MAP)) {
    if (lower.includes(term)) {
      keywords.push(...kws);
    }
  }

  // 2. 也从原始查询中提取2字以上的中文词作为关键词
  const chineseWords = query.match(/[一-龥]{2,}/g) || [];
  for (const w of chineseWords) {
    if (!keywords.includes(w)) keywords.push(w);
  }

  // 3. 添加原始英文单词
  const englishWords = query.match(/[a-zA-Z]+/g) || [];
  for (const w of englishWords) {
    if (!keywords.includes(w)) keywords.push(w);
  }

  if (keywords.length === 0) return [];

  // 构建 ILIKE 条件
  const conditions = keywords.map((_, i) =>
    `(section_title ILIKE $${i + 1} OR text_content ILIKE $${i + 1})`
  );
  const params = keywords.map(k => `%${k}%`);

  const sql = `
    SELECT section_id, section_title, chunk_index, text_content, source_type, file_path, 0.5 AS similarity
    FROM sp_doc_embeddings
    WHERE ${conditions.join(' OR ')}
    ORDER BY section_id, chunk_index
    LIMIT $${params.length + 1}
  `;

  params.push(String(limit));
  const rows = await db.prepare(sql).all(...params) as any[];

  const results: DocSearchResult[] = rows.map((r: any) => ({
    sectionId: r.sectionId || r.section_id,
    sectionTitle: r.sectionTitle || r.section_title,
    chunkIndex: r.chunkIndex || r.chunk_index || 0,
    textContent: r.textContent || r.text_content,
    similarity: 0.5,
    sourceType: r.source_type || 'doc_section',
    filePath: r.file_path || undefined,
  }));
  return results;
}

export async function getDocIndexStats(): Promise<{
  sectionCount: number;
  chunkCount: number;
  lastIndexed: string | null;
  sourceBreakdown?: Record<string, number>;
}> {
  const row = await db.prepare(
    'SELECT COUNT(DISTINCT section_id) as sc, COUNT(*) as cc, MAX(created_at) as li FROM sp_doc_embeddings'
  ).get() as any;

  const breakdownRows = await db.prepare(
    'SELECT source_type, COUNT(DISTINCT section_id) as cnt FROM sp_doc_embeddings GROUP BY source_type'
  ).all() as any[];

  const sourceBreakdown: Record<string, number> = {};
  for (const r of breakdownRows) {
    const st = r.source_type || 'doc_section';
    sourceBreakdown[st] = (sourceBreakdown[st] || 0) + Number(r.cnt);
  }

  return {
    sectionCount: row?.sc || 0,
    chunkCount: row?.cc || 0,
    lastIndexed: row?.li || null,
    sourceBreakdown,
  };
}
