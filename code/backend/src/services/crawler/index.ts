import axios from 'axios';
import * as cheerio from 'cheerio';
import { JobData, TaskConfig } from '../../types';

export abstract class BaseCrawler {
  protected signal: AbortSignal | null = null;

  abstract crawl(config: TaskConfig, signal: AbortSignal): AsyncGenerator<JobData>;

  // 设置请求头
  protected getHeaders() {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    };
  }

  // 获取页面内容
  protected async fetchPage(url: string, timeout = 15000): Promise<string> {
    if (this.signal?.aborted) throw new Error('Task aborted');

    console.log(`[BaseCrawler] 正在请求: ${url}`);
    console.log(`[BaseCrawler] 请求头:`, JSON.stringify(this.getHeaders(), null, 2));

    try {
      const response = await axios.get(url, {
        headers: this.getHeaders(),
        timeout,
        maxRedirects: 5,
        validateStatus: (status) => status < 500 // 允许4xx状态码
      });

      console.log(`[BaseCrawler] 响应状态码: ${response.status}`);
      console.log(`[BaseCrawler] 响应内容类型: ${response.headers['content-type']}`);
      console.log(`[BaseCrawler] 响应数据长度: ${response.data.length} 字符`);

      // 检查是否被重定向到登录页或验证码页
      if (response.data.includes('login') || response.data.includes('captcha') || response.data.includes('验证')) {
        console.warn(`[BaseCrawler] ⚠️ 可能被重定向到登录页或验证码页面`);
      }

      return response.data;
    } catch (error: any) {
      console.error(`[BaseCrawler] ❌ 请求失败:`, error.message);
      if (error.response) {
        console.error(`[BaseCrawler] 错误状态码: ${error.response.status}`);
        console.error(`[BaseCrawler] 错误响应:`, error.response.data.substring(0, 500));
      }
      throw error;
    }
  }

  // 随机延迟
  protected async randomDelay(min: number = 2000, max: number = 5000): Promise<void> {
    if (this.signal?.aborted) return;
    const delay = Math.random() * (max - min) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // 清理文本
  protected cleanText(text: string): string {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
  }

  // 检查是否终止
  protected checkAborted(): boolean {
    return this.signal?.aborted || false;
  }
}
