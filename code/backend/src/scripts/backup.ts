import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

const pool = new Pool({
  host: '10.1.1.113',
  port: 7300,
  database: 'training_exercises',
  user: 'liangwenqing',
  password: 'liangwenqing',
  connectionTimeoutMillis: 5000,
});

const SCHEMA = 'liangwenqing';
const CSV_DIR = path.resolve(__dirname, '../../data/csv');
const OUTPUT_DIR = path.resolve(__dirname, '../../data/backups');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

async function main() {
  console.log('[Backup] 开始数据库+文件备份...');
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${SCHEMA}, public`);

    // 1. 获取所有表名
    const tableResult = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = $1 AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `, [SCHEMA]);

    const tables = tableResult.rows.map(r => r.table_name);
    console.log(`[Backup] 发现 ${tables.length} 个表:`, tables.join(', '));

    const backupData: any = {
      backup_time: new Date().toISOString(),
      schema: SCHEMA,
      database: 'training_exercises',
      host: '10.1.1.113:7300',
      tables: {},
    };

    // 2. 导出每个表的结构和数据
    for (const table of tables) {
      console.log(`[Backup] 导出表: ${table}`);

      // 获取列信息
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default,
               character_maximum_length, udt_name
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
      `, [SCHEMA, table]);

      // 获取数据
      const dataResult = await client.query(`SELECT * FROM "${SCHEMA}"."${table}"`);

      // 处理特殊类型（如 vector 类型无法 JSON 序列化）
      const rows = dataResult.rows.map(row => {
        const processed: any = {};
        for (const key of Object.keys(row)) {
          const val = row[key];
          // vector 类型转为字符串，Date 对象转为 ISO 字符串
          if (val !== null && typeof val === 'object' && !Array.isArray(val) && val.constructor?.name !== 'Date') {
            // 可能是 vector 或其他自定义类型，转字符串
            processed[key] = String(val);
          } else if (val instanceof Date) {
            processed[key] = val.toISOString();
          } else {
            processed[key] = val;
          }
        }
        return processed;
      });

      const tableInfo = {
        columns: columnsResult.rows.map(c => ({
          name: c.column_name,
          type: c.udt_name,
          nullable: c.is_nullable === 'YES',
          default: c.column_default,
          maxLength: c.character_maximum_length,
        })),
        rowCount: dataResult.rowCount,
        data: rows,
      };

      backupData.tables[table] = tableInfo;
    }

    // 3. 写入完整的备份 JSON
    const jsonFile = path.join(OUTPUT_DIR, `backup_${TIMESTAMP}.json`);
    fs.writeFileSync(jsonFile, JSON.stringify(backupData, null, 2), 'utf-8');
    console.log(`[Backup] JSON 备份已保存: ${jsonFile} (${(fs.statSync(jsonFile).size / 1024).toFixed(1)} KB)`);

    // 4. 创建 ZIP 压缩包
    const zipFile = path.join(OUTPUT_DIR, `backup_${TIMESTAMP}.zip`);
    const output = fs.createWriteStream(zipFile);
    const archive = archiver('zip', { zlib: { level: 9 } });

    await new Promise<void>((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);

      // 添加 JSON 备份文件
      archive.file(jsonFile, { name: `backup_${TIMESTAMP}.json` });

      // 添加所有 CSV/Excel 文件
      if (fs.existsSync(CSV_DIR)) {
        const files = fs.readdirSync(CSV_DIR);
        for (const file of files) {
          const filePath = path.join(CSV_DIR, file);
          if (fs.statSync(filePath).isFile()) {
            archive.file(filePath, { name: `files/${file}` });
          }
        }
        console.log(`[Backup] 添加 ${files.length} 个数据文件`);
      } else {
        console.log('[Backup] ⚠️ CSV 目录不存在，跳过文件打包');
      }

      archive.finalize();
    });

    console.log(`[Backup] ZIP 备份已创建: ${zipFile} (${(fs.statSync(zipFile).size / 1024 / 1024).toFixed(2)} MB)`);

    // 5. 清理单独的 JSON 文件（已包含在 ZIP 中）
    fs.unlinkSync(jsonFile);

    console.log('[Backup] ✅ 备份完成!');
    return { zipFile, tables: tables.length, filesInZip: 0, timestamp: TIMESTAMP };

  } finally {
    client.release();
    await pool.end();
  }
}

main()
  .then(result => {
    console.log('[Backup] 结果:', JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error('[Backup] 失败:', err);
    process.exit(1);
  });
