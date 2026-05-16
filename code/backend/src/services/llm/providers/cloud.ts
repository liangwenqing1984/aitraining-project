import { LLMCallOptions, LLMCallResult, LLMProvider, EmbeddingResult } from '../../../types';

export class CloudProvider {
  name: LLMProvider;

  constructor(name: LLMProvider) {
    this.name = name;
  }

  private getApiPath(endpoint: string): string {
    // Zhipu uses /api/paas/v4 prefix, not /v1
    if (this.name === 'zhipu') {
      return `/${endpoint}`;
    }
    return `/v1/${endpoint}`;
  }

  async call(
    modelName: string,
    systemPrompt: string,
    userPrompt: string,
    options: LLMCallOptions & { apiKey?: string; baseUrl?: string }
  ): Promise<LLMCallResult> {
    const baseUrl = options.baseUrl || this.getDefaultBaseUrl();
    const apiKey = options.apiKey || process.env.OPENAI_API_KEY || '';

    if (!apiKey) {
      throw new Error(`缺少 ${this.name} API Key，请在设置中配置`);
    }

    const url = `${baseUrl}${this.getApiPath('chat/completions')}`;
    const body: any = {
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 4096,
    };

    if (options.responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    if (options.stream) {
      body.stream = true;
    }

    // For Anthropic via OpenAI-compatible endpoint
    if (this.name === 'anthropic') {
      body.max_tokens = options.maxTokens ?? 4096;
      // Some Anthropic-compatible proxies need these headers
    }

    const timeoutMs = (options as any).timeoutMs || 60000;
    const controller = new AbortController();
    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }
    const timeout = setTimeout(() => controller.abort(new Error(`LLM 调用超时（${timeoutMs}ms）`)), timeoutMs);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      const errorText = await response.text().catch(() => '未知错误');
      throw new Error(`LLM API 错误 (${response.status}): ${errorText.substring(0, 200)}`);
    }

    const data: any = await response.json();
    const message = data.choices?.[0]?.message || {};
    let content = message.content || '';

    // Handle reasoning models (DeepSeek-R1/V4, etc.) where thinking tokens consume max_tokens
    if (!content.trim() && message.reasoning_content) {
      const errMsg = `推理模型思考占满了token限制(${options.maxTokens ?? 4096})，content为空。reasoning_content长度: ${message.reasoning_content.length}。需要更大的maxTokens。`;
      console.warn(`[CloudProvider.${this.name}] ${errMsg}`);
      throw new Error(`REASONING_EXHAUSTED: ${errMsg}`);
    }

    const usage = data.usage;

    return {
      content,
      model: data.model || modelName,
      provider: this.name,
      tokensUsed: usage ? {
        prompt: usage.prompt_tokens || 0,
        completion: usage.completion_tokens || 0,
        total: usage.total_tokens || 0,
      } : undefined,
      duration: 0,
    };
  }

  async embed(
    text: string,
    modelName: string,
    options: { apiKey?: string; baseUrl?: string }
  ): Promise<EmbeddingResult> {
    const baseUrl = options.baseUrl || this.getDefaultBaseUrl();
    const apiKey = options.apiKey || process.env.OPENAI_API_KEY || '';

    if (!apiKey) {
      throw new Error(`缺少 ${this.name} API Key，无法调用 Embedding API`);
    }

    const start = Date.now();
    const url = `${baseUrl}${this.getApiPath('embeddings')}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: modelName, input: text }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '未知错误');
      throw new Error(`Embedding API 错误 (${response.status}): ${errText.substring(0, 200)}`);
    }

    const data: any = await response.json();
    const embedding = data.data?.[0]?.embedding as number[];

    if (!embedding || embedding.length === 0) {
      throw new Error(`${this.name} Embedding API 返回空 embedding`);
    }

    return {
      embedding,
      tokens: data.usage?.total_tokens || 0,
      duration: Date.now() - start,
    };
  }

  async healthCheck(apiKey?: string, baseUrl?: string, modelName?: string): Promise<{ ok: boolean; models: string[]; latency: number; error?: string }> {
    const key = apiKey || process.env.OPENAI_API_KEY || '';
    const url = baseUrl || this.getDefaultBaseUrl();
    const testModel = modelName || 'gpt-3.5-turbo';
    const start = Date.now();

    console.log(`[CloudProvider.${this.name}] healthCheck: url=${url}, model=${testModel}, hasKey=${!!key}`);

    if (!key && this.name !== 'ollama') {
      console.log(`[CloudProvider.${this.name}] healthCheck: 无 API Key，返回失败`);
      return { ok: false, models: [], latency: 0, error: '未配置 API Key，请在前端 AI 配置页面填写' };
    }

    // 策略1：先尝试 /v1/models（标准 OpenAI 端点，DeepSeek/智谱可能不支持）
    try {
      const response = await fetch(`${url}${this.getApiPath('models')}`, {
        headers: { 'Authorization': `Bearer ${key}` },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data: any = await response.json();
        const models: string[] = (data.data || []).map((m: any) => m.id).slice(0, 20);
        return { ok: true, models, latency: Date.now() - start };
      }
    } catch {
      // /v1/models 不支持，降级到策略2
    }

    // 策略2：用配置的模型发一条简单对话（适用于所有 OpenAI 兼容 API）
    try {
      const response = await fetch(`${url}${this.getApiPath('chat/completions')}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (response.ok) {
        const data: any = await response.json();
        const usedModel = data.model || testModel;
        return { ok: true, models: [usedModel], latency: Date.now() - start };
      }

      const errorText = await response.text().catch(() => '');
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errJson = JSON.parse(errorText);
        errorMsg = errJson.error?.message || errJson.message || errorMsg;
      } catch {}
      console.error(`[CloudProvider.${this.name}] 策略2失败: url=${url}${this.getApiPath('chat/completions')}, status=${response.status}, body=${errorText.substring(0, 300)}`);
      return { ok: false, models: [], latency: Date.now() - start, error: `${errorMsg} (端点: ${url})` };
    } catch (e: any) {
      return { ok: false, models: [], latency: Date.now() - start, error: e.message || '网络连接失败' };
    }
  }

  private getDefaultBaseUrl(): string {
    switch (this.name) {
      case 'openai':
        return 'https://api.openai.com';
      case 'anthropic':
        return 'https://api.anthropic.com';
      case 'deepseek':
        return 'https://api.deepseek.com';
      case 'zhipu':
        return 'https://open.bigmodel.cn/api/paas/v4';
      default:
        return 'https://api.openai.com';
    }
  }
}
