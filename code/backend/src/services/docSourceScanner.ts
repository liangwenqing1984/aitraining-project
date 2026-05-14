import * as fs from 'fs';
import * as path from 'path';

// ==================== 类型枚举 ====================

export enum SourceType {
  DOC_SECTION = 'doc_section',
  USER_DOC = 'user_doc',
  DIAGNOSTIC = 'diagnostic',
  DESIGN_DOC = 'design_doc',
  BACKEND_SOURCE = 'backend_source',
  FRONTEND_SOURCE = 'frontend_source',
}

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  [SourceType.DOC_SECTION]: '帮助文档',
  [SourceType.USER_DOC]: '用户手册',
  [SourceType.DIAGNOSTIC]: '诊断文档',
  [SourceType.DESIGN_DOC]: '设计文档',
  [SourceType.BACKEND_SOURCE]: '后端源代码',
  [SourceType.FRONTEND_SOURCE]: '前端源代码',
};

// ==================== 文件源配置 ====================

export interface SourceConfig {
  type: SourceType;
  label: string;
  baseDir: string;
  globPattern: (filename: string) => boolean;
}

export const FILE_SOURCE_CONFIGS: SourceConfig[] = [
  {
    type: SourceType.USER_DOC,
    label: '用户手册',
    baseDir: 'docs',
    globPattern: (f) => f.endsWith('.md'),
  },
  {
    type: SourceType.DIAGNOSTIC,
    label: '诊断文档',
    baseDir: 'docs/diagnostics',
    globPattern: (f) => f.endsWith('.md'),
  },
  {
    type: SourceType.DESIGN_DOC,
    label: '设计文档',
    baseDir: 'doc',
    globPattern: (f) => f.endsWith('.md'),
  },
  {
    type: SourceType.BACKEND_SOURCE,
    label: '后端源代码',
    baseDir: 'code/backend/src',
    globPattern: (f) => f.endsWith('.ts'),
  },
  {
    type: SourceType.FRONTEND_SOURCE,
    label: '前端源代码',
    baseDir: 'code/frontend/src',
    globPattern: (f) => f.endsWith('.ts') || f.endsWith('.vue'),
  },
];

// ==================== 数据结构 ====================

export interface ScannedFile {
  filePath: string;
  sourceType: SourceType;
  title: string;
  content: string;
}

// ==================== 核心函数 ====================

export function resolveProjectRoot(): string {
  // __dirname = code/backend/src/services → project root = ../../../
  return path.resolve(__dirname, '..', '..', '..', '..');
}

/**
 * 从 Markdown 文件中提取标题（第一个 # 标题），失败则用文件名
 */
function extractMdTitle(content: string, filename: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match) {
    // 去掉编号前缀如 "145_"
    return match[1].trim();
  }
  // 用文件名作为 fallback
  return filename.replace(/\.md$/, '').replace(/^\d+[_-]/, '').replace(/[_-]/g, ' ');
}

/**
 * 递归扫描目录，返回匹配的文件列表
 */
function walkDir(
  dir: string,
  rootDir: string,
  globPattern: (filename: string) => boolean,
  files: string[]
): void {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
      walkDir(fullPath, rootDir, globPattern, files);
    } else if (entry.isFile() && globPattern(entry.name)) {
      files.push(path.relative(rootDir, fullPath));
    }
  }
}

/**
 * 扫描所有文件源，返回 ScannedFile 数组
 */
export function scanFiles(sourceTypes?: SourceType[]): ScannedFile[] {
  const projectRoot = resolveProjectRoot();
  const configs = sourceTypes
    ? FILE_SOURCE_CONFIGS.filter(c => sourceTypes.includes(c.type))
    : FILE_SOURCE_CONFIGS;

  console.log(`[DocScanner] 项目根目录: ${projectRoot}`);
  console.log(`[DocScanner] 待扫描配置: ${configs.map(c => c.label).join(', ') || '(无)'}`);

  const results: ScannedFile[] = [];

  for (const config of configs) {
    const baseDir = path.join(projectRoot, config.baseDir);
    console.log(`[DocScanner] 检查目录: ${baseDir}`);
    if (!fs.existsSync(baseDir)) {
      console.log(`[DocScanner] 目录不存在，跳过: ${config.baseDir} (绝对路径: ${baseDir})`);
      continue;
    }

    const matchedFiles: string[] = [];
    walkDir(baseDir, baseDir, config.globPattern, matchedFiles);

    for (const relativePath of matchedFiles) {
      const fullPath = path.join(baseDir, relativePath);
      try {
        let content = fs.readFileSync(fullPath, 'utf-8');
        // 跳过空文件
        if (!content.trim()) continue;

        // Markdown: 提取标题
        const filename = path.basename(relativePath);
        let title: string;
        if (filename.endsWith('.md') || filename.endsWith('.MD')) {
          title = extractMdTitle(content, filename);
        } else {
          // 源代码：使用相对路径作为标题
          title = relativePath.replace(/\\/g, '/');
        }

        results.push({
          filePath: path.posix.join(config.baseDir, relativePath).replace(/\\/g, '/'),
          sourceType: config.type,
          title,
          content,
        });
      } catch (e: any) {
        console.warn(`[DocScanner] 读取文件失败: ${relativePath}`, e.message);
      }
    }

    console.log(`[DocScanner] ${config.label}: 发现 ${matchedFiles.length} 个文件`);
  }

  return results;
}

/**
 * 生成唯一 section_id
 */
export function generateSectionId(file: ScannedFile): string {
  return `${file.sourceType}::${file.filePath}`;
}
