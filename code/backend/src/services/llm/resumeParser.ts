import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

/**
 * 从文件 buffer 中提取文本
 * 支持 .docx (mammoth) / .pdf (pdf-parse) / .txt (utf-8)
 */
export async function extractResumeText(
  buffer: Buffer,
  mimetype: string,
  originalname: string
): Promise<string> {
  const ext = originalname.toLowerCase().split('.').pop();

  if (ext === 'docx' || mimetype.includes('word') || mimetype.includes('docx')) {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value?.trim();
    if (!text) throw new Error('无法从 Word 文件中提取文本内容');
    return text;
  }

  if (ext === 'pdf' || mimetype.includes('pdf')) {
    const result = await pdfParse(buffer);
    const text = result.text?.trim();
    if (!text) throw new Error('无法从 PDF 文件中提取文本内容');
    return text;
  }

  // .txt or fallback: try utf-8 first, then gbk/latin1
  let text = buffer.toString('utf-8').trim();
  if (!text) {
    text = buffer.toString('latin1').trim();
  }
  if (!text) throw new Error('无法从文件中提取文本内容，请确认文件格式');
  return text;
}
