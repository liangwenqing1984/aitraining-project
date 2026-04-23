import path from 'path';
import fs from 'fs';

export class CsvWriter {
  private filepath: string;
  private writeStream: fs.WriteStream;
  private headerWritten: boolean = false;

  constructor(filename: string, private header: string[] = []) {
    const csvDir = path.join(__dirname, '../../data/csv');

    // 确保目录存在
    if (!fs.existsSync(csvDir)) {
      fs.mkdirSync(csvDir, { recursive: true });
    }

    this.filepath = path.join(csvDir, filename);
    this.writeStream = fs.createWriteStream(this.filepath, { encoding: 'utf-8' });
  }

  writeRow(row: Record<string, any>): void {
    if (!this.headerWritten) {
      const header = this.header.join(',') + '\n';
      this.writeStream.write(header);
      this.headerWritten = true;
    }

    const values = this.header.map(key => this.escapeCsv(row[key]));
    this.writeStream.write(values.join(',') + '\n');
  }

  async end(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.writeStream.end((err: Error | null | undefined) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  getFilepath(): string {
    return this.filepath;
  }

  getFileSize(): number {
    if (fs.existsSync(this.filepath)) {
      return fs.statSync(this.filepath).size;
    }
    return 0;
  }

  private escapeCsv(value: any): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}
