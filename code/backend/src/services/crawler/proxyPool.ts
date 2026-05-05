import axios from 'axios';

export interface ProxyInfo {
  proxy: string;   // "ip:port"
  type: string;    // "http" | "https"
  source?: string;
  score?: number;
  https?: boolean;
}

export class ProxyPool {
  private poolUrl: string;
  private consecutiveFailures: number = 0;
  private maxConsecutiveFailures: number = 5;
  private requestTimeout: number = 5000;

  constructor(poolUrl: string = 'http://127.0.0.1:5010') {
    this.poolUrl = poolUrl.replace(/\/$/, ''); // 去掉尾部斜杠
  }

  /**
   * 随机获取一个可用代理
   */
  async getProxy(type?: 'http' | 'https'): Promise<ProxyInfo | null> {
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      console.warn('[ProxyPool] 代理池连续失败已达上限，跳过获取');
      return null;
    }

    try {
      let url = `${this.poolUrl}/get/`;
      if (type) url += `?type=${type}`;

      const resp = await axios.get(url, { timeout: this.requestTimeout });
      const data = resp.data;
      if (data && data.proxy) {
        this.consecutiveFailures = 0;
        return {
          proxy: data.proxy,
          type: data.type || 'http',
          source: data.source,
          score: data.score,
          https: data.https,
        };
      }
      return null;
    } catch (e: any) {
      this.consecutiveFailures++;
      console.warn(`[ProxyPool] 获取代理失败(${this.consecutiveFailures}/${this.maxConsecutiveFailures}): ${e.message}`);
      return null;
    }
  }

  /**
   * 获取一个代理并同时从池中删除
   */
  async popProxy(type?: 'http' | 'https'): Promise<ProxyInfo | null> {
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      return null;
    }

    try {
      let url = `${this.poolUrl}/pop/`;
      if (type) url += `?type=${type}`;

      const resp = await axios.get(url, { timeout: this.requestTimeout });
      const data = resp.data;
      if (data && data.proxy) {
        this.consecutiveFailures = 0;
        return {
          proxy: data.proxy,
          type: data.type || 'http',
          source: data.source,
          score: data.score,
          https: data.https,
        };
      }
      return null;
    } catch (e: any) {
      this.consecutiveFailures++;
      console.warn(`[ProxyPool] pop代理失败(${this.consecutiveFailures}): ${e.message}`);
      return null;
    }
  }

  /**
   * 从代理池删除指定代理
   */
  async deleteProxy(proxy: string): Promise<boolean> {
    try {
      const resp = await axios.get(`${this.poolUrl}/delete/`, {
        params: { proxy },
        timeout: this.requestTimeout,
      });
      return resp.status === 200;
    } catch (e: any) {
      console.warn(`[ProxyPool] 删除代理失败: ${proxy} - ${e.message}`);
      return false;
    }
  }

  /**
   * 获取代理池当前数量
   */
  async getCount(): Promise<number> {
    try {
      const resp = await axios.get(`${this.poolUrl}/count`, {
        timeout: this.requestTimeout,
      });
      // 返回格式: { count: 10 } 或直接返回数字
      if (typeof resp.data === 'number') return resp.data;
      if (resp.data && typeof resp.data.count === 'number') return resp.data.count;
      const match = JSON.stringify(resp.data).match(/"count":\s*(\d+)/);
      if (match) return parseInt(match[1]);
      return 0;
    } catch (e: any) {
      console.warn(`[ProxyPool] 查询代理数量失败: ${e.message}`);
      return -1;
    }
  }

  /**
   * 获取所有代理
   */
  async getAllProxies(type?: 'http' | 'https'): Promise<ProxyInfo[]> {
    try {
      let url = `${this.poolUrl}/all/`;
      if (type) url += `?type=${type}`;
      const resp = await axios.get(url, { timeout: this.requestTimeout });
      if (Array.isArray(resp.data)) {
        return resp.data.map((item: any) => ({
          proxy: item.proxy,
          type: item.type || 'http',
          source: item.source,
          score: item.score,
          https: item.https,
        }));
      }
      return [];
    } catch (e: any) {
      console.warn(`[ProxyPool] 获取所有代理失败: ${e.message}`);
      return [];
    }
  }

  /**
   * 快速检测代理可用性（尝试连接目标站点）
   */
  async checkHealth(proxy: string, testUrl: string = 'https://www.51job.com/'): Promise<boolean> {
    try {
      const [host, port] = proxy.split(':');
      // 使用简单 HTTP 请求检测代理是否可用
      await axios.get(testUrl, {
        proxy: {
          host,
          port: parseInt(port || '80'),
          protocol: 'http',
        },
        timeout: 8000,
        maxRedirects: 5,
        validateStatus: (status) => status < 500, // 4xx 可能正常（网站正常响应）
      });
      return true;
    } catch (e: any) {
      // 超时或连接失败视为不可用
      return false;
    }
  }

  /**
   * 将代理格式化为 Puppeteer --proxy-server 参数值
   */
  formatProxyArg(proxy: string): string {
    return `http://${proxy}`;
  }

  /**
   * 获取 Puppeteer launch args 中的代理参数
   */
  getProxyArgs(proxy: string): string[] {
    return [`--proxy-server=http://${proxy}`];
  }

  /**
   * 重置连续失败计数器（代理池恢复时调用）
   */
  resetFailures(): void {
    this.consecutiveFailures = 0;
  }

  /**
   * 是否可用（连续失败未达上限）
   */
  isAvailable(): boolean {
    return this.consecutiveFailures < this.maxConsecutiveFailures;
  }
}
