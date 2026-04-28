import { LLMCallOptions, LLMCallResult } from '../../../types';

export class LocalProvider {
  name = 'ollama' as const;

  async call(
    modelName: string,
    systemPrompt: string,
    userPrompt: string,
    options: LLMCallOptions
  ): Promise<LLMCallResult> {
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const url = `${baseUrl}/api/generate`;

    // Ollama doesn't have native system prompt, so we combine them
    const combinedPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

    const body: any = {
      model: modelName,
      prompt: combinedPrompt,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.3,
        num_predict: options.maxTokens ?? 4096,
      },
    };

    // For JSON output, instruct the model
    if (options.responseFormat === 'json') {
      body.format = 'json';
      body.system = systemPrompt; // Ollama supports system prompt in recent versions
      body.prompt = userPrompt;
    }

    const controller = new AbortController();
    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '未知错误');
      throw new Error(`Ollama API 错误 (${response.status}): ${errorText.substring(0, 200)}`);
    }

    const data: any = await response.json();

    return {
      content: data.response || '',
      model: data.model || modelName,
      provider: 'ollama',
      tokensUsed: data.eval_count ? {
        prompt: data.prompt_eval_count || 0,
        completion: data.eval_count || 0,
        total: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      } : undefined,
      duration: 0,
    };
  }

  async healthCheck(_apiKey?: string, _baseUrl?: string, _modelName?: string): Promise<{ ok: boolean; models: string[]; latency: number; error?: string }> {
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const start = Date.now();

    try {
      const response = await fetch(`${baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return { ok: false, models: [], latency: Date.now() - start, error: `Ollama 服务返回 ${response.status}` };
      }

      const data: any = await response.json();
      const models: string[] = (data.models || []).map((m: any) => m.name);
      return { ok: true, models, latency: Date.now() - start };
    } catch (e: any) {
      return { ok: false, models: [], latency: Date.now() - start, error: e.message || '无法连接到 Ollama 服务' };
    }
  }
}
